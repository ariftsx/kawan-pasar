import { Inject, Injectable } from '@nestjs/common';
import { sql } from 'drizzle-orm';
import { z } from 'zod';
import type { Db } from '../../database/client.js';
import { DRIZZLE } from '../../database/database.module.js';

/**
 * The bundle shown to users: the newest active non-demo bundle, otherwise the active demo bundle.
 * A real ARIF-Net bundle therefore replaces the demo as soon as it is promoted.
 */
export const ACTIVE_ARTIFACT_CTE = sql`
  active AS (
    SELECT id, model_name, model_version, data_version, preprocess_version,
           data_cutoff, issued_at, is_demo
    FROM forecast_artifacts
    WHERE status = 'active'
    ORDER BY is_demo ASC, issued_at DESC
    LIMIT 1
  )`;

const Horizon7Row = z.object({
  issued_at: z.coerce.date(),
  code: z.string().nullable(),
  q50: z.number().nullable(),
});

export interface Horizon7Summary {
  readonly issuedAt: Date | null;
  readonly q50ByCommodity: ReadonlyMap<string, number | null>;
}

@Injectable()
export class ActiveArtifactRepository {
  constructor(@Inject(DRIZZLE) private readonly db: Db) {}

  /** One query: issue time of the active bundle and its 7-day median change per commodity. */
  async horizonSummary(marketCode: string, horizonDays: number): Promise<Horizon7Summary> {
    const result = await this.db.execute(sql`
      WITH ${ACTIVE_ARTIFACT_CTE}
      SELECT a.issued_at, c.code, f.q50_change::float8 AS q50
      FROM active a
      LEFT JOIN forecasts f
        ON f.artifact_id = a.id
       AND f.horizon_days = ${horizonDays}
       AND f.market_id = (SELECT id FROM markets WHERE code = ${marketCode})
      LEFT JOIN commodities c ON c.id = f.commodity_id`);
    const rows = z.array(Horizon7Row).parse(result.rows);
    const first = rows[0];
    return {
      issuedAt: first === undefined ? null : first.issued_at,
      q50ByCommodity: new Map(
        rows.flatMap((r) => (r.code === null ? [] : [[r.code, r.q50] as const])),
      ),
    };
  }
}
