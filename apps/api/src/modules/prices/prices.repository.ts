import type { HistoryRange, PricePoint } from '@kawan-pasar/contracts';
import { Inject, Injectable } from '@nestjs/common';
import { sql } from 'drizzle-orm';
import { z } from 'zod';
import type { Db } from '../../database/client.js';
import { DRIZZLE } from '../../database/database.module.js';

const SPARKLINE_POINTS = 30;

const PointSchema = z.object({ observedOn: z.string(), priceIdr: z.number().int() });

const SummaryRow = z.object({
  code: z.string(),
  latest_on: z.string().nullable(),
  price_idr: z.number().int().nullable(),
  price_7d_idr: z.number().int().nullable(),
  price_30d_idr: z.number().int().nullable(),
  sparkline: z.array(PointSchema),
});
export type SummaryRow = z.infer<typeof SummaryRow>;

const RANGE_DAYS: Record<Exclude<HistoryRange, 'all'>, number> = {
  '30d': 30,
  '90d': 90,
  '365d': 365,
};

@Injectable()
export class PricesRepository {
  constructor(@Inject(DRIZZLE) private readonly db: Db) {}

  /**
   * One query for the whole summary: every commodity, its latest/reference prices from the
   * materialized view and its last 30 observations (LATERAL), so there is no per-commodity query.
   */
  async summary(marketCode: string): Promise<SummaryRow[]> {
    const result = await this.db.execute(sql`
      WITH m AS (SELECT id FROM markets WHERE code = ${marketCode})
      SELECT c.code,
             to_char(v.observed_on, 'YYYY-MM-DD') AS latest_on,
             v.price_idr, v.price_7d_idr, v.price_30d_idr,
             COALESCE(s.points, '[]'::json) AS sparkline
      FROM commodities c
      CROSS JOIN m
      LEFT JOIN mv_latest_prices v ON v.market_id = m.id AND v.commodity_id = c.id
      LEFT JOIN LATERAL (
        SELECT json_agg(json_build_object('observedOn', to_char(p.observed_on, 'YYYY-MM-DD'),
                                          'priceIdr', p.price_idr) ORDER BY p.observed_on) AS points
        FROM (
          SELECT observed_on, price_idr FROM price_observations
          WHERE market_id = m.id AND commodity_id = c.id
          ORDER BY observed_on DESC
          LIMIT ${SPARKLINE_POINTS}
        ) p
      ) s ON true
      ORDER BY c.sort_order`);
    return z.array(SummaryRow).parse(result.rows);
  }

  /**
   * History before the latest observation (data can be late, so windows are anchored on the data,
   * not on today). `all` keeps the last observation of each ISO week.
   */
  async history(
    marketCode: string,
    commodityCode: string,
    range: HistoryRange,
  ): Promise<PricePoint[]> {
    const scope = sql`
      market_id = (SELECT id FROM markets WHERE code = ${marketCode})
      AND commodity_id = (SELECT id FROM commodities WHERE code = ${commodityCode})`;
    const query =
      range === 'all'
        ? sql`
          SELECT observed_on, price_idr FROM (
            SELECT DISTINCT ON (date_trunc('week', observed_on)) observed_on, price_idr
            FROM price_observations WHERE ${scope}
            ORDER BY date_trunc('week', observed_on), observed_on DESC
          ) w`
        : sql`
          SELECT observed_on, price_idr FROM price_observations
          WHERE ${scope}
            AND observed_on > (SELECT max(observed_on) FROM price_observations WHERE ${scope})
                              - ${RANGE_DAYS[range]}::int`;
    const result = await this.db.execute(sql`
      SELECT to_char(observed_on, 'YYYY-MM-DD') AS "observedOn", price_idr AS "priceIdr"
      FROM (${query}) q ORDER BY observed_on`);
    return z.array(PointSchema).parse(result.rows);
  }
}
