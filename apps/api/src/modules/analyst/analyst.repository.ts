import { and, asc, desc, eq, gte, inArray, lte } from 'drizzle-orm';
import type { SQL } from 'drizzle-orm';
import type { Db } from '../../database/client.js';
import {
  analystRequests,
  auditLog,
  commodities,
  forecastArtifacts,
  forecasts,
  markets,
  priceObservations,
  users,
} from '../../database/schema/index.js';

export interface PriceRow {
  market: string;
  commodity: string;
  name: string;
  date: string;
  price: number;
  source: string;
}

export interface ForecastRow {
  market: string;
  commodity: string;
  baseDate: string;
  horizon: number;
  q10: string | null;
  q50: string | null;
  q90: string | null;
  p10: number | null;
  p50: number | null;
  p90: number | null;
  evalStatus: string;
}

export interface ActiveForecasts {
  artifact: { id: number; modelVersion: string; isDemo: boolean } | null;
  rows: ForecastRow[];
}

export type AuditActionName = (typeof auditLog.$inferInsert)['action'];

export interface LatestRequest {
  id: number;
  status: 'pending' | 'approved' | 'rejected';
  createdAt: Date;
  note: string | null;
}

const UNIQUE_VIOLATION = '23505';
/** Upper bound per export (review finding): the whole history is about 6 000 rows today. */
export const EXPORT_MAX_ROWS = 100_000;

export class AnalystRepository {
  constructor(private readonly db: Db) {}

  async latestRequest(userId: string): Promise<LatestRequest | null> {
    const rows = await this.db
      .select({
        id: analystRequests.id,
        status: analystRequests.status,
        createdAt: analystRequests.createdAt,
        note: analystRequests.note,
      })
      .from(analystRequests)
      .where(eq(analystRequests.userId, userId))
      .orderBy(desc(analystRequests.id))
      .limit(1);
    return rows[0] ?? null;
  }

  /**
   * Creates a request and its audit entry in one transaction. The user's row is locked (the role
   * CLI locks it too), so a grant can never interleave between the role check and the insert.
   * Returns the new id, or why not: `email` (unverified), `role` (not a plain user), `pending`.
   */
  async createRequest(
    userId: string,
    reason: string,
    organization: string | null,
  ): Promise<number | 'email' | 'role' | 'pending'> {
    try {
      return await this.db.transaction(async (tx) => {
        const rows = await tx
          .select({ role: users.role, verified: users.emailVerifiedAt })
          .from(users)
          .where(eq(users.id, userId))
          .for('update');
        const user = rows[0];
        if (user === undefined || user.verified === null) return 'email';
        if (user.role !== 'user') return 'role';
        const created = await tx
          .insert(analystRequests)
          .values({ userId, reason, organization })
          .returning({ id: analystRequests.id });
        const id = created[0]?.id;
        if (id === undefined) return 'pending';
        await tx.insert(auditLog).values({
          actorId: userId,
          action: 'role_request',
          target: `analyst_request:${String(id)}`,
        });
        return id;
      });
    } catch (e) {
      if (pgCode(e) === UNIQUE_VIOLATION) return 'pending';
      throw e;
    }
  }

  async audit(
    actorId: string | null,
    action: AuditActionName,
    target: string | null,
  ): Promise<void> {
    await this.db.insert(auditLog).values({ actorId, action, target });
  }

  /** Observations of Pasar Kramat Jati (the only market with data) for the export. */
  async prices(
    codes: readonly string[] | undefined,
    from: string | undefined,
    to: string | undefined,
  ): Promise<PriceRow[]> {
    const where: SQL[] = [eq(markets.code, 'PIKJ')];
    if (codes !== undefined) where.push(inArray(commodities.code, [...codes]));
    if (from !== undefined) where.push(gte(priceObservations.observedOn, from));
    if (to !== undefined) where.push(lte(priceObservations.observedOn, to));
    return this.db
      .select({
        market: markets.code,
        commodity: commodities.code,
        name: commodities.name,
        date: priceObservations.observedOn,
        price: priceObservations.priceIdr,
        source: priceObservations.source,
      })
      .from(priceObservations)
      .innerJoin(markets, eq(markets.id, priceObservations.marketId))
      .innerJoin(commodities, eq(commodities.id, priceObservations.commodityId))
      .where(and(...where))
      .orderBy(asc(commodities.code), asc(priceObservations.observedOn))
      .limit(EXPORT_MAX_ROWS);
  }

  /** Rows of the forecast bundle the product shows (newest active non-demo, else demo). */
  async activeForecasts(codes: readonly string[] | undefined): Promise<ActiveForecasts> {
    const best = await this.db
      .select({
        id: forecastArtifacts.id,
        modelVersion: forecastArtifacts.modelVersion,
        isDemo: forecastArtifacts.isDemo,
      })
      .from(forecastArtifacts)
      .where(eq(forecastArtifacts.status, 'active'))
      .orderBy(asc(forecastArtifacts.isDemo), desc(forecastArtifacts.issuedAt))
      .limit(1);
    const artifact = best[0];
    if (artifact === undefined) return { artifact: null, rows: [] };
    const where: SQL[] = [eq(forecasts.artifactId, artifact.id)];
    if (codes !== undefined) where.push(inArray(commodities.code, [...codes]));
    const rows = await this.db
      .select({
        market: markets.code,
        commodity: commodities.code,
        baseDate: forecasts.baseDate,
        horizon: forecasts.horizonDays,
        q10: forecasts.q10Change,
        q50: forecasts.q50Change,
        q90: forecasts.q90Change,
        p10: forecasts.q10PriceIdr,
        p50: forecasts.q50PriceIdr,
        p90: forecasts.q90PriceIdr,
        evalStatus: forecasts.evalStatus,
      })
      .from(forecasts)
      .innerJoin(markets, eq(markets.id, forecasts.marketId))
      .innerJoin(commodities, eq(commodities.id, forecasts.commodityId))
      .where(and(...where))
      .orderBy(asc(commodities.code), asc(forecasts.horizonDays))
      .limit(EXPORT_MAX_ROWS);
    return { artifact, rows };
  }
}

/** SQLSTATE of a pg error, also when Drizzle wraps it (DrizzleQueryError.cause). */
function pgCode(e: unknown): string | undefined {
  if (typeof e !== 'object' || e === null) return undefined;
  const own: unknown = Reflect.get(e, 'code');
  if (typeof own === 'string') return own;
  const cause: unknown = Reflect.get(e, 'cause');
  return cause === undefined ? undefined : pgCode(cause);
}
