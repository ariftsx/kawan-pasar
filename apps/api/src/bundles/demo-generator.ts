import { createHash } from 'node:crypto';
import { COMMODITIES, HORIZONS } from '@kawan-pasar/catalog';
import type { CommodityCode, Horizon, MarketCode } from '@kawan-pasar/catalog';
import type { BundleForecastRow, EvalStatus, PricePoint } from '@kawan-pasar/contracts';
import { DEMO_MODEL_NAME } from './bundle-promoter.js';
import type { BundleContent } from './bundle-writer.js';

/**
 * DEMO bundle — NOT ARIF-Net. Method: historical empirical quantiles. For each horizon h, collect
 * the relative change r = P(t')/P(t) − 1 over every observation day t in the look-back window,
 * where t' is the last observation on or before t + h days; q10/q50/q90 are linear-interpolated
 * quantiles of those changes. It exists only so the product can show the forecast UI, always
 * labelled "Data demo" (ADR 0006).
 */
export interface DemoOptions {
  readonly marketCode: MarketCode;
  readonly now: Date;
  readonly lookbackDays?: number;
}

const DAY_MS = 86_400_000;
const DEFAULT_LOOKBACK_DAYS = 730;

const evalStatus = (h: Horizon): EvalStatus =>
  h <= 30 ? 'available' : h === 90 ? 'partial' : 'not_tested';

const round6 = (x: number): number => Math.round(x * 1e6) / 1e6;
const dayNumber = (iso: string): number => Math.floor(Date.parse(`${iso}T00:00:00Z`) / DAY_MS);

/** Linear-interpolated quantile (type 7) of an ascending array. */
function quantile(sorted: readonly number[], p: number): number {
  const pos = (sorted.length - 1) * p;
  const lo = Math.floor(pos);
  const hi = Math.ceil(pos);
  const a = sorted[lo] ?? 0;
  const b = sorted[hi] ?? a;
  return a + (b - a) * (pos - lo);
}

/** Index of the last point whose day ≤ target (points ascending), or -1. */
function lastAtOrBefore(days: readonly number[], target: number): number {
  let lo = 0;
  let hi = days.length - 1;
  let found = -1;
  while (lo <= hi) {
    const mid = (lo + hi) >> 1;
    if ((days[mid] ?? Infinity) <= target) {
      found = mid;
      lo = mid + 1;
    } else hi = mid - 1;
  }
  return found;
}

function rowsFor(
  market: MarketCode,
  commodity: CommodityCode,
  points: readonly PricePoint[],
  lookbackDays: number,
): BundleForecastRow[] {
  const sorted = [...points].sort((a, b) => a.observedOn.localeCompare(b.observedOn));
  const base = sorted.at(-1);
  if (base === undefined) return [];
  const days = sorted.map((p) => dayNumber(p.observedOn));
  const baseDay = dayNumber(base.observedOn);

  return HORIZONS.map((h): BundleForecastRow => {
    const changes: number[] = [];
    sorted.forEach((p, i) => {
      const day = days[i] ?? 0;
      if (day < baseDay - lookbackDays || day + h > baseDay) return;
      const j = lastAtOrBefore(days, day + h);
      const later = sorted[j];
      if (later !== undefined) changes.push(later.priceIdr / p.priceIdr - 1);
    });
    changes.sort((a, b) => a - b);
    const empty = changes.length === 0;
    const q = (p: number): number | null => (empty ? null : round6(quantile(changes, p)));
    const price = (c: number | null): number | null =>
      c === null ? null : Math.max(1, Math.round(base.priceIdr * (1 + c)));
    const [q10, q50, q90] = [q(0.1), q(0.5), q(0.9)];
    return {
      market_code: market,
      commodity_code: commodity,
      base_date: base.observedOn,
      horizon_days: h,
      q10_change: q10,
      q50_change: q50,
      q90_change: q90,
      q10_price_idr: price(q10),
      q50_price_idr: price(q50),
      q90_price_idr: price(q90),
      eval_status: empty ? 'not_tested' : evalStatus(h),
    };
  });
}

/** UTC issue time as YYYYMMDDHHMM (bundle ids allow only [a-z0-9._-]). */
const issuedStamp = (now: Date): string => now.toISOString().slice(0, 16).replace(/[-:T]/g, '');

function dataCutoff(baseDate: string, now: Date): string {
  const endOfDay = new Date(`${baseDate}T23:59:59+07:00`);
  return endOfDay.getTime() <= now.getTime() ? `${baseDate}T23:59:59+07:00` : now.toISOString();
}

export function generateDemoBundle(
  series: ReadonlyMap<CommodityCode, readonly PricePoint[]>,
  options: DemoOptions,
): BundleContent {
  const lookback = options.lookbackDays ?? DEFAULT_LOOKBACK_DAYS;
  const rows = COMMODITIES.filter((c) => c.modelCoverage === 'covered').flatMap((c) =>
    rowsFor(options.marketCode, c.code, series.get(c.code) ?? [], lookback),
  );
  const baseDate =
    rows
      .map((r) => r.base_date)
      .sort()
      .at(-1) ?? '1970-01-01';
  const digest = createHash('sha256').update(JSON.stringify(rows)).digest('hex').slice(0, 8);
  return {
    metadata: {
      // Issue time is part of the id so a later run can replace an expiring demo bundle.
      bundle_id: `demo-${baseDate}-${issuedStamp(options.now)}-${digest}`,
      model_name: DEMO_MODEL_NAME,
      model_version: 'demo-empirical-quantile-v1',
      data_version: `seed-csv-${baseDate}`,
      preprocess_version: 'none',
      // End of the base day (WIB), but never later than the issue time (base day = today).
      data_cutoff: dataCutoff(baseDate, options.now),
      issued_at: options.now.toISOString(),
    },
    rows,
  };
}
