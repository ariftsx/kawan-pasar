import { COMMODITIES } from '@kawan-pasar/catalog';
import type { ModelCoverage } from '@kawan-pasar/catalog';
import { Inject, Injectable } from '@nestjs/common';
import { sql } from 'drizzle-orm';
import { z } from 'zod';
import { CacheService } from '../../cache/cache.service.js';
import type { Db } from '../../database/client.js';
import { DRIZZLE } from '../../database/database.module.js';
import { ACTIVE_ARTIFACT_CTE } from './active-artifact.repository.js';

const TTL_SECONDS = 3_600;

const Snapshot = z.object({ active: z.boolean(), codes: z.array(z.string()) });
export type CoverageSnapshot = z.infer<typeof Snapshot>;

/**
 * Fase 4C (owner ruling K1): a commodity is covered by the model when the active bundle has its
 * 7-day forecast (the horizon the price summary shows), so approving a 5-commodity bundle shows
 * cabai rawit forecasts without a code change.
 * Before any bundle is active, the catalog's initial coverage applies (unchanged first-run state).
 */
export function coverageOf(code: string, snapshot: CoverageSnapshot): ModelCoverage {
  if (!snapshot.active) {
    return COMMODITIES.find((c) => c.code === code)?.modelCoverage ?? 'pending';
  }
  return snapshot.codes.includes(code) ? 'covered' : 'pending';
}

@Injectable()
export class CoverageService {
  constructor(
    @Inject(DRIZZLE) private readonly db: Db,
    private readonly cache: CacheService,
  ) {}

  /** Cached under the forecasts scope, which every promotion invalidates. */
  async snapshot(): Promise<CoverageSnapshot> {
    return this.cache.getOrLoad('forecasts:coverage', TTL_SECONDS, Snapshot, async () => {
      const result = await this.db.execute(sql`
        WITH ${ACTIVE_ARTIFACT_CTE}
        SELECT EXISTS (SELECT 1 FROM active) AS active,
               COALESCE((SELECT array_agg(DISTINCT c.code ORDER BY c.code)
                         FROM forecasts f
                         JOIN active a ON f.artifact_id = a.id
                         JOIN commodities c ON c.id = f.commodity_id
                         WHERE f.horizon_days = 7), '{}') AS codes`);
      return Snapshot.parse(result.rows[0]);
    });
  }

  async of(code: string): Promise<ModelCoverage> {
    return coverageOf(code, await this.snapshot());
  }
}
