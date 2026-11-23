import type {
  AnalystRequestInput,
  AnalystStatusResponse,
  ExportQuery,
} from '@kawan-pasar/contracts';
import { csvCell } from '@kawan-pasar/contracts';
import { conflict } from '../../common/api-errors.js';
import type { AuthRateLimiter } from '../auth/auth-rate-limiter.js';
import type { UsersRepository } from '../auth/users.repository.js';
import type { AnalystRepository } from './analyst.repository.js';

/** Plan 3A task 4: downloads per account and hour. */
export const EXPORTS_PER_HOUR = { limit: 30, windowSeconds: 3600 } as const;

const PRICE_HEADER = ['pasar', 'komoditas', 'nama', 'tanggal', 'harga_idr', 'sumber'];
const FORECAST_HEADER = [
  'pasar',
  'komoditas',
  'tanggal_dasar',
  'horizon_hari',
  'q10_perubahan',
  'q50_perubahan',
  'q90_perubahan',
  'q10_harga_idr',
  'q50_harga_idr',
  'q90_harga_idr',
  'status_uji',
  'model',
  'versi_model',
  'data_demo',
];

const line = (cells: readonly (string | number | null)[]): string => cells.map(csvCell).join(',');

export class AnalystService {
  constructor(
    private readonly repo: AnalystRepository,
    private readonly users: UsersRepository,
    private readonly limiter: AuthRateLimiter,
  ) {}

  async status(userId: string): Promise<AnalystStatusResponse> {
    const [user, request] = await Promise.all([
      this.users.findById(userId),
      this.repo.latestRequest(userId),
    ]);
    const role = user?.role ?? 'user';
    return {
      role,
      request:
        request === null
          ? null
          : {
              status: request.status,
              createdAt: request.createdAt.toISOString(),
              note: request.note,
            },
      canRequest:
        role === 'user' &&
        (user?.emailVerifiedAt ?? null) !== null &&
        request?.status !== 'pending',
    };
  }

  async request(userId: string, input: AnalystRequestInput): Promise<void> {
    const result = await this.repo.createRequest(userId, input.reason, input.organization ?? null);
    if (typeof result === 'string') throw conflict(result);
  }

  async pricesCsv(userId: string, q: ExportQuery): Promise<string> {
    await this.limiter.hit('export', userId, EXPORTS_PER_HOUR);
    const rows = await this.repo.prices(q.commodities, q.from, q.to);
    await this.repo.audit(userId, 'export_prices', `rows:${String(rows.length)}`);
    return [
      line(PRICE_HEADER),
      ...rows.map((r) => line([r.market, r.commodity, r.name, r.date, r.price, r.source])),
    ]
      .join('\r\n')
      .concat('\r\n');
  }

  async forecastsCsv(userId: string, q: ExportQuery): Promise<string> {
    await this.limiter.hit('export', userId, EXPORTS_PER_HOUR);
    const { artifact, rows } = await this.repo.activeForecasts(q.commodities);
    await this.repo.audit(userId, 'export_forecasts', `rows:${String(rows.length)}`);
    return [
      line(FORECAST_HEADER),
      ...rows.map((r) =>
        line([
          r.market,
          r.commodity,
          r.baseDate,
          r.horizon,
          r.q10,
          r.q50,
          r.q90,
          r.p10,
          r.p50,
          r.p90,
          r.evalStatus,
          artifact === null ? null : artifact.isDemo ? 'demo' : 'arif-net',
          artifact?.modelVersion ?? null,
          artifact === null ? null : artifact.isDemo ? 'ya' : 'tidak',
        ]),
      ),
    ]
      .join('\r\n')
      .concat('\r\n');
  }
}
