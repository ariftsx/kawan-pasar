import { sql } from 'drizzle-orm';
import { z } from 'zod';
import type { Db } from '../../database/client.js';
import { notifications } from '../../database/schema/index.js';
import type { ForecastPoint, News, Point } from './rules.js';
import {
  FORECAST_RISE_HORIZONS,
  USUAL_LOOKBACK_DAYS,
  crossed,
  forecastRise,
  forecastRiseNews,
  thresholdNews,
  unusualMove,
  unusualMoveNews,
} from './rules.js';

/**
 * Evaluates every watch after new prices or a new forecast bundle (design Fase 2 § 4). A fixed
 * number of queries whatever the number of watches: the watched (market, commodity) pairs with
 * their recent prices, the active non-demo forecasts of those pairs, the watches with their
 * owner's switches, then batched inserts. Idempotent: notifications_once (user, kind,
 * commodity, data date) turns a repeated evaluation into no-ops.
 */

const INSERT_BATCH = 500;
/** PIHPS publishes a day late: a watch made today still hears about yesterday's prices. */
const WATCH_GRACE_DAYS = 1;

export interface EvaluationResult {
  watches: number;
  created: number;
}

const SeriesRow = z.object({
  market_id: z.number(),
  commodity_id: z.number(),
  commodity_code: z.string(),
  commodity_name: z.string(),
  market_name: z.string(),
  day: z.number(),
  price_idr: z.number(),
});

const ForecastRow = z.object({
  market_id: z.number(),
  commodity_id: z.number(),
  base_date: z.string(),
  horizon_days: z.number(),
  q10_change: z.coerce.number().nullable(),
  q50_change: z.coerce.number().nullable(),
  q90_change: z.coerce.number().nullable(),
  q10_price_idr: z.number().nullable(),
  q50_price_idr: z.number().nullable(),
  q90_price_idr: z.number().nullable(),
  model_version: z.string(),
  issued_at: z.coerce.date(),
});

const WatchRow = z.object({
  user_id: z.string(),
  market_id: z.number(),
  commodity_id: z.number(),
  threshold_idr: z.number().nullable(),
  direction: z.enum(['above', 'below']).nullable(),
  created_day: z.number(),
  created_at: z.coerce.date(),
  unusual_move: z.boolean(),
  forecast_rise: z.boolean(),
  price_threshold: z.boolean(),
});

export interface Pair {
  marketId: number;
  commodityId: number;
  code: string;
  name: string;
  marketName: string;
  points: Point[];
  forecasts: ForecastPoint[];
  forecastBase: string | null;
  modelVersion: string | null;
  forecastIssuedAt: Date | null;
}

export const key = (market: number, commodity: number): string =>
  `${String(market)}:${String(commodity)}`;
export const isoDay = (day: number): string =>
  new Date(day * 86_400_000).toISOString().slice(0, 10);

export async function loadPairs(db: Db): Promise<Map<string, Pair>> {
  const series = await db.execute(sql`
    WITH pairs AS (SELECT DISTINCT market_id, commodity_id FROM alert_watches),
    last AS (
      SELECT p.market_id, p.commodity_id, max(p.observed_on) AS d
      FROM price_observations p JOIN pairs USING (market_id, commodity_id)
      GROUP BY p.market_id, p.commodity_id
    )
    SELECT p.market_id, p.commodity_id, c.code AS commodity_code, c.name AS commodity_name,
           m.name AS market_name, (p.observed_on - DATE '1970-01-01')::int AS day, p.price_idr
    FROM price_observations p
    JOIN last l USING (market_id, commodity_id)
    JOIN commodities c ON c.id = p.commodity_id
    JOIN markets m ON m.id = p.market_id
    WHERE p.observed_on >= l.d - ${USUAL_LOOKBACK_DAYS + 7}::int
    ORDER BY p.market_id, p.commodity_id, p.observed_on`);
  const pairs = new Map<string, Pair>();
  for (const r of z.array(SeriesRow).parse(series.rows)) {
    const k = key(r.market_id, r.commodity_id);
    let pair = pairs.get(k);
    if (pair === undefined) {
      pair = {
        marketId: r.market_id,
        commodityId: r.commodity_id,
        code: r.commodity_code,
        name: r.commodity_name,
        marketName: r.market_name,
        points: [],
        forecasts: [],
        forecastBase: null,
        modelVersion: null,
        forecastIssuedAt: null,
      };
      pairs.set(k, pair);
    }
    pair.points.push({ day: r.day, price: r.price_idr });
  }

  // Only real models: a demo bundle never produces "Prediksi naik" news (design Fase 2 § 4).
  const fc = await db.execute(sql`
    WITH pairs AS (SELECT DISTINCT market_id, commodity_id FROM alert_watches),
    best AS (
      SELECT DISTINCT ON (f.market_id, f.commodity_id) f.artifact_id, f.market_id, f.commodity_id
      FROM forecasts f
      JOIN forecast_artifacts a ON a.id = f.artifact_id
      JOIN pairs USING (market_id, commodity_id)
      WHERE a.status = 'active' AND NOT a.is_demo
      ORDER BY f.market_id, f.commodity_id, a.issued_at DESC
    )
    SELECT f.market_id, f.commodity_id, to_char(f.base_date, 'YYYY-MM-DD') AS base_date,
           f.horizon_days, f.q10_change, f.q50_change, f.q90_change,
           f.q10_price_idr, f.q50_price_idr, f.q90_price_idr, a.model_version, a.issued_at
    FROM forecasts f
    JOIN best b ON b.artifact_id = f.artifact_id AND b.market_id = f.market_id
                AND b.commodity_id = f.commodity_id
    JOIN forecast_artifacts a ON a.id = f.artifact_id
    WHERE f.horizon_days IN (${sql.raw(FORECAST_RISE_HORIZONS.join(', '))})`);
  for (const r of z.array(ForecastRow).parse(fc.rows)) {
    const pair = pairs.get(key(r.market_id, r.commodity_id));
    if (pair === undefined) continue;
    pair.forecastBase = r.base_date;
    pair.modelVersion = r.model_version;
    pair.forecastIssuedAt = r.issued_at;
    pair.forecasts.push({
      horizonDays: r.horizon_days,
      q10Change: r.q10_change,
      q50Change: r.q50_change,
      q90Change: r.q90_change,
      q10PriceIdr: r.q10_price_idr,
      q50PriceIdr: r.q50_price_idr,
      q90PriceIdr: r.q90_price_idr,
    });
  }
  return pairs;
}

type NewNotification = typeof notifications.$inferInsert;

export async function evaluateAlerts(db: Db): Promise<EvaluationResult> {
  const pairs = await loadPairs(db);
  // Only verified accounts with in-app news on (switches default to on, see alert_preferences).
  const watchRows = await db.execute(sql`
    SELECT w.user_id, w.market_id, w.commodity_id, w.threshold_idr, w.direction,
           (timezone('Asia/Jakarta', w.created_at)::date - DATE '1970-01-01')::int AS created_day,
           w.created_at,
           coalesce(p.unusual_move, true) AS unusual_move,
           coalesce(p.forecast_rise, true) AS forecast_rise,
           coalesce(p.price_threshold, true) AS price_threshold
    FROM alert_watches w
    JOIN users u ON u.id = w.user_id AND u.email_verified_at IS NOT NULL
    LEFT JOIN alert_preferences p ON p.user_id = w.user_id
    WHERE coalesce(p.in_app, true)`);
  const watches = z.array(WatchRow).parse(watchRows.rows);

  // Each pair is evaluated once, whatever the number of its watchers.
  const verdicts = new Map<
    string,
    { unusual: News | null; forecast: News | null; dataDate: string | null }
  >();
  for (const [k, p] of pairs) {
    const last = p.points.at(-1);
    const move = unusualMove(p.points);
    const rise = forecastRise(p.forecasts);
    const riseChange = rise === null ? null : rise.q50Change;
    verdicts.set(k, {
      dataDate: last === undefined ? null : isoDay(last.day),
      unusual:
        move === null || last === undefined
          ? null
          : unusualMoveNews({
              commodityName: p.name,
              marketName: p.marketName,
              price: last.price,
              change: move.change,
              usual: move.usual,
              dataDate: isoDay(last.day),
            }),
      forecast:
        rise === null || riseChange === null || p.modelVersion === null || p.forecastBase === null
          ? null
          : forecastRiseNews({
              commodityName: p.name,
              horizonDays: rise.horizonDays,
              q50Change: riseChange,
              q10PriceIdr: rise.q10PriceIdr,
              q50PriceIdr: rise.q50PriceIdr,
              q90PriceIdr: rise.q90PriceIdr,
              modelVersion: p.modelVersion,
              dataDate: p.forecastBase,
            }),
    });
  }

  const rows: NewNotification[] = [];
  for (const w of watches) {
    const k = key(w.market_id, w.commodity_id);
    const p = pairs.get(k);
    const v = verdicts.get(k);
    const last = p?.points.at(-1);
    const previous = p?.points.at(-2);
    if (p === undefined || v === undefined || last === undefined || v.dataDate === null) continue;
    const base = {
      userId: w.user_id,
      marketId: w.market_id,
      commodityId: w.commodity_id,
    };
    // A watch reports what happens after it was made, not history it was created after.
    const freshPrice = last.day >= w.created_day - WATCH_GRACE_DAYS;
    if (w.unusual_move && freshPrice && v.unusual !== null) {
      rows.push({
        ...base,
        kind: 'unusual_move',
        dataDate: v.dataDate,
        ...v.unusual,
        link: `/harga/${p.code}`,
      });
    }
    if (
      w.price_threshold &&
      freshPrice &&
      w.threshold_idr !== null &&
      w.direction !== null &&
      previous !== undefined &&
      crossed(previous.price, last.price, w.threshold_idr, w.direction)
    ) {
      rows.push({
        ...base,
        kind: 'price_threshold',
        dataDate: v.dataDate,
        ...thresholdNews({
          commodityName: p.name,
          marketName: p.marketName,
          previous: previous.price,
          price: last.price,
          threshold: w.threshold_idr,
          direction: w.direction,
          dataDate: v.dataDate,
        }),
        link: `/harga/${p.code}`,
      });
    }
    const freshForecast = p.forecastIssuedAt !== null && p.forecastIssuedAt >= w.created_at;
    if (w.forecast_rise && freshForecast && v.forecast !== null && p.forecastBase !== null) {
      rows.push({
        ...base,
        kind: 'forecast_rise',
        dataDate: p.forecastBase,
        ...v.forecast,
        link: `/prediksi/${p.code}`,
        modelVersion: p.modelVersion,
      });
    }
  }

  let created = 0;
  for (let i = 0; i < rows.length; i += INSERT_BATCH) {
    const inserted = await db
      .insert(notifications)
      .values(rows.slice(i, i + INSERT_BATCH))
      .onConflictDoNothing()
      .returning({ id: notifications.id });
    created += inserted.length;
  }
  return { watches: watches.length, created };
}
