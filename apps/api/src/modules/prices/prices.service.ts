import { COMMODITIES } from '@kawan-pasar/catalog';
import type { Market } from '@kawan-pasar/catalog';
import { HistoryResponseSchema, PriceSummaryResponseSchema } from '@kawan-pasar/contracts';
import type {
  CommoditySummary,
  Direction,
  HistoryRange,
  PriceSummaryResponse,
} from '@kawan-pasar/contracts';
import { Inject, Injectable } from '@nestjs/common';
import { CacheService } from '../../cache/cache.service.js';
import { resolveCommodity, toMarketDto } from '../../common/catalog-lookup.js';
import { CLOCK } from '../../common/clock.js';
import type { Clock } from '../../common/clock.js';
import { ActiveArtifactRepository } from '../forecasts/active-artifact.repository.js';
import { forecastStatus } from '../forecasts/forecast-status.js';
import { PricesRepository } from './prices.repository.js';
import type { SummaryRow } from './prices.repository.js';
import { dataStatus, wibDate } from './staleness.js';
import { SUMMARY_MAX_TTL_SECONDS, summaryTtlSeconds } from './summary-ttl.js';

const TTL_SECONDS = 3_600;
/** |median change| below this is shown as "stabil". */
const FLAT_THRESHOLD = 0.005;

const round4 = (x: number): number => Math.round(x * 10_000) / 10_000;

function change(price: number | null, reference: number | null): number | null {
  if (price === null || reference === null || reference === 0) return null;
  return round4((price - reference) / reference);
}

function direction(q50: number | null): Direction | null {
  if (q50 === null) return null;
  if (Math.abs(q50) < FLAT_THRESHOLD) return 'flat';
  return q50 > 0 ? 'up' : 'down';
}

@Injectable()
export class PricesService {
  constructor(
    private readonly prices: PricesRepository,
    private readonly artifacts: ActiveArtifactRepository,
    private readonly cache: CacheService,
    @Inject(CLOCK) private readonly clock: Clock,
  ) {}

  /**
   * JSON text of the summary (served as-is on cache hits). The entry expires no later than the
   * next moment an embedded status can change (summaryTtlSeconds), so it never disagrees with
   * /forecast or the staleness rule for longer than one request.
   */
  summary(market: Market): Promise<string> {
    let ttl = SUMMARY_MAX_TTL_SECONDS;
    return this.cache.getOrLoadJson(
      `prices:summary:${market.code}`,
      () => ttl,
      PriceSummaryResponseSchema,
      async () => {
        const { value, ttlSeconds } = await this.loadSummary(market);
        ttl = ttlSeconds;
        return value;
      },
    );
  }

  /** JSON text of the history (served as-is on cache hits). */
  history(market: Market, commodityCode: string, range: HistoryRange): Promise<string> {
    const commodity = resolveCommodity(commodityCode);
    return this.cache.getOrLoadJson(
      `prices:history:${market.code}:${commodity.code}:${range}`,
      TTL_SECONDS,
      HistoryResponseSchema,
      async () => ({
        market: toMarketDto(market),
        commodity: { code: commodity.code, name: commodity.name },
        range,
        downsampled: range === 'all',
        points:
          market.status === 'available'
            ? await this.prices.history(market.code, commodity.code, range)
            : [],
      }),
    );
  }

  private async loadSummary(
    market: Market,
  ): Promise<{ value: PriceSummaryResponse; ttlSeconds: number }> {
    if (market.status !== 'available') {
      return {
        value: { market: toMarketDto(market), latestObservedOn: null, items: [] },
        ttlSeconds: SUMMARY_MAX_TTL_SECONDS,
      };
    }
    const [rows, forecast] = await Promise.all([
      this.prices.summary(market.code),
      this.artifacts.horizonSummary(market.code, 7),
    ]);
    const now = this.clock.now();
    const today = wibDate(now);
    const byCode = new Map(rows.map((r) => [r.code, r]));

    const items = COMMODITIES.map((c): CommoditySummary => {
      const row: SummaryRow | undefined = byCode.get(c.code);
      const latestOn = row?.latest_on ?? null;
      const price = row?.price_idr ?? null;
      const byBundle = forecastStatus(
        c.modelCoverage,
        forecast.issuedAt === null ? null : { issuedAt: forecast.issuedAt },
        now,
      );
      // Same rule as /forecast: a covered commodity absent from the active bundle is unavailable.
      const inBundle = forecast.q50ByCommodity.has(c.code);
      const status =
        (byBundle === 'available' || byBundle === 'expired') && !inBundle
          ? 'unavailable'
          : byBundle;
      const visible = status === 'available' || status === 'expired';
      const q50 = visible ? (forecast.q50ByCommodity.get(c.code) ?? null) : null;
      return {
        code: c.code,
        name: c.name,
        unit: c.unit,
        modelCoverage: c.modelCoverage,
        dataStatus: dataStatus(latestOn, today),
        latest:
          latestOn !== null && price !== null ? { observedOn: latestOn, priceIdr: price } : null,
        change7d: change(price, row?.price_7d_idr ?? null),
        change30d: change(price, row?.price_30d_idr ?? null),
        sparkline: row?.sparkline ?? [],
        forecast7d: { status, q50Change: q50, direction: direction(q50) },
      };
    });

    const observed = items.flatMap((i) => (i.latest === null ? [] : [i.latest.observedOn]));
    return {
      value: {
        market: toMarketDto(market),
        latestObservedOn: observed.length === 0 ? null : (observed.sort().at(-1) ?? null),
        items,
      },
      ttlSeconds: summaryTtlSeconds(now, forecast.issuedAt),
    };
  }
}
