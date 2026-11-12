import type { Market } from '@kawan-pasar/catalog';
import { ForecastResponseSchema, HorizonSchema } from '@kawan-pasar/contracts';
import type { ForecastHorizon, ForecastResponse } from '@kawan-pasar/contracts';
import { Inject, Injectable } from '@nestjs/common';
import { CacheService } from '../../cache/cache.service.js';
import { resolveCommodity, toMarketDto } from '../../common/catalog-lookup.js';
import { CLOCK } from '../../common/clock.js';
import type { Clock } from '../../common/clock.js';
import { ageDays, forecastStatus } from './forecast-status.js';
import { ForecastsRepository } from './forecasts.repository.js';
import type { ForecastRow } from './forecasts.repository.js';

const TTL_SECONDS = 3_600;

function addDays(date: string, days: number): string {
  const d = new Date(`${date}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

function toHorizon(r: ForecastRow): ForecastHorizon[] {
  if (r.base_date === null || r.horizon_days === null || r.eval_status === null) return [];
  return [
    {
      horizonDays: HorizonSchema.parse(r.horizon_days),
      targetDate: addDays(r.base_date, r.horizon_days),
      q10Change: r.q10_change,
      q50Change: r.q50_change,
      q90Change: r.q90_change,
      q10PriceIdr: r.q10_price_idr,
      q50PriceIdr: r.q50_price_idr,
      q90PriceIdr: r.q90_price_idr,
      evalStatus: r.eval_status,
    },
  ];
}

@Injectable()
export class ForecastsService {
  constructor(
    private readonly repo: ForecastsRepository,
    private readonly cache: CacheService,
    @Inject(CLOCK) private readonly clock: Clock,
  ) {}

  /**
   * The status is computed on every request (it depends on "now"); only the database rows are
   * cached, so an expiring bundle changes status on time even while cached.
   */
  async forCommodity(market: Market, commodityCode: string): Promise<ForecastResponse> {
    const commodity = resolveCommodity(commodityCode);
    const base: Omit<
      ForecastResponse,
      'status' | 'artifact' | 'baseDate' | 'basePriceIdr' | 'horizons'
    > = {
      market: toMarketDto(market),
      commodity: {
        code: commodity.code,
        name: commodity.name,
        modelCoverage: commodity.modelCoverage,
      },
    };
    const empty = { artifact: null, baseDate: null, basePriceIdr: null, horizons: [] };

    if (commodity.modelCoverage === 'pending' || market.status !== 'available') {
      return {
        ...base,
        status: commodity.modelCoverage === 'pending' ? 'pending_coverage' : 'unavailable',
        ...empty,
      };
    }

    const cached = await this.cache.getOrLoad(
      `forecasts:${market.code}:${commodity.code}`,
      TTL_SECONDS,
      ForecastResponseSchema,
      async (): Promise<ForecastResponse> => {
        const rows = await this.repo.forCommodity(market.code, commodity.code);
        const first = rows[0];
        if (first === undefined) return { ...base, status: 'unavailable', ...empty };
        const horizons = rows.flatMap(toHorizon);
        return {
          ...base,
          status: 'available',
          artifact: {
            modelName: first.model_name,
            modelVersion: first.model_version,
            dataVersion: first.data_version,
            preprocessVersion: first.preprocess_version,
            dataCutoff: first.data_cutoff.toISOString(),
            issuedAt: first.issued_at.toISOString(),
            isDemo: first.is_demo,
            ageDays: 0,
          },
          baseDate: first.base_date,
          basePriceIdr: first.base_price_idr,
          horizons,
        };
      },
    );
    return this.applyAge(cached);
  }

  /** Applies the 8/28-day rule to cached rows using the current time. */
  private applyAge(stored: ForecastResponse): ForecastResponse {
    const artifact = stored.artifact;
    if (artifact === null) return stored;
    const now = this.clock.now();
    if (stored.horizons.length === 0) {
      return {
        ...stored,
        status: 'unavailable',
        artifact: { ...artifact, ageDays: ageDays(new Date(artifact.issuedAt), now) },
      };
    }
    const status = forecastStatus('covered', { issuedAt: new Date(artifact.issuedAt) }, now);
    const withAge = { ...artifact, ageDays: ageDays(new Date(artifact.issuedAt), now) };
    if (status === 'hidden') {
      return {
        ...stored,
        status,
        artifact: withAge,
        baseDate: null,
        basePriceIdr: null,
        horizons: [],
      };
    }
    return { ...stored, status, artifact: withAge };
  }
}
