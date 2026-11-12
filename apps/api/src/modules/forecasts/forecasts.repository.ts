import { Inject, Injectable } from '@nestjs/common';
import { sql } from 'drizzle-orm';
import { z } from 'zod';
import type { Db } from '../../database/client.js';
import { DRIZZLE } from '../../database/database.module.js';
import { ACTIVE_ARTIFACT_CTE } from './active-artifact.repository.js';

const ForecastRow = z.object({
  model_name: z.string(),
  model_version: z.string(),
  data_version: z.string(),
  preprocess_version: z.string(),
  data_cutoff: z.coerce.date(),
  issued_at: z.coerce.date(),
  is_demo: z.boolean(),
  base_date: z.string().nullable(),
  horizon_days: z.number().int().nullable(),
  q10_change: z.number().nullable(),
  q50_change: z.number().nullable(),
  q90_change: z.number().nullable(),
  q10_price_idr: z.number().int().nullable(),
  q50_price_idr: z.number().int().nullable(),
  q90_price_idr: z.number().int().nullable(),
  eval_status: z.enum(['available', 'partial', 'not_tested']).nullable(),
  base_price_idr: z.number().int().nullable(),
});
export type ForecastRow = z.infer<typeof ForecastRow>;

@Injectable()
export class ForecastsRepository {
  constructor(@Inject(DRIZZLE) private readonly db: Db) {}

  /**
   * One query: the active bundle's metadata, its rows for (market, commodity) and the observed
   * price on the base date. No bundle → no rows; bundle without this commodity → one row with
   * null forecast columns.
   */
  async forCommodity(marketCode: string, commodityCode: string): Promise<ForecastRow[]> {
    const result = await this.db.execute(sql`
      WITH ${ACTIVE_ARTIFACT_CTE},
      scope AS (
        SELECT (SELECT id FROM markets WHERE code = ${marketCode}) AS market_id,
               (SELECT id FROM commodities WHERE code = ${commodityCode}) AS commodity_id
      )
      SELECT a.model_name, a.model_version, a.data_version, a.preprocess_version,
             a.data_cutoff, a.issued_at, a.is_demo,
             to_char(f.base_date, 'YYYY-MM-DD') AS base_date, f.horizon_days,
             f.q10_change::float8 AS q10_change, f.q50_change::float8 AS q50_change,
             f.q90_change::float8 AS q90_change,
             f.q10_price_idr, f.q50_price_idr, f.q90_price_idr, f.eval_status::text AS eval_status,
             (SELECT p.price_idr FROM price_observations p
               WHERE p.market_id = s.market_id AND p.commodity_id = s.commodity_id
                 AND p.observed_on = f.base_date) AS base_price_idr
      FROM active a
      CROSS JOIN scope s
      LEFT JOIN forecasts f
        ON f.artifact_id = a.id AND f.market_id = s.market_id AND f.commodity_id = s.commodity_id
      ORDER BY f.horizon_days`);
    return z.array(ForecastRow).parse(result.rows);
  }
}
