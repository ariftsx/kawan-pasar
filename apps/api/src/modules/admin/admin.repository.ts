import { and, asc, desc, eq } from 'drizzle-orm';
import type { Db } from '../../database/client.js';
import {
  analystRequests,
  auditLog,
  forecastArtifacts,
  ingestRuns,
  notifications,
  users,
} from '../../database/schema/index.js';

export type AuditActionName = (typeof auditLog.$inferInsert)['action'];

export interface PendingRequest {
  id: number;
  email: string;
  reason: string;
  organization: string | null;
  createdAt: Date;
}

export type RevokeResult = 'revoked' | 'not_found' | 'protected' | 'not_analyst';

export type DecisionResult =
  { ok: true; email: string } | { ok: false; why: 'not_found' | 'decided' | 'self' };

/** WIB calendar day (UTC+7, no daylight saving) of an instant. */
const wibDay = (at: Date): string =>
  new Date(at.getTime() + 7 * 3_600_000).toISOString().slice(0, 10);

/** Data access of the admin pages (Fase 3B). */
export class AdminRepository {
  constructor(private readonly db: Db) {}

  async audit(actorId: string, action: AuditActionName, target: string | null): Promise<void> {
    await this.db.insert(auditLog).values({ actorId, action, target });
  }

  async pendingRequests(): Promise<PendingRequest[]> {
    return this.db
      .select({
        id: analystRequests.id,
        email: users.email,
        reason: analystRequests.reason,
        organization: analystRequests.organization,
        createdAt: analystRequests.createdAt,
      })
      .from(analystRequests)
      .innerJoin(users, eq(users.id, analystRequests.userId))
      .where(eq(analystRequests.status, 'pending'))
      .orderBy(asc(analystRequests.createdAt), asc(analystRequests.id))
      .limit(200);
  }

  /**
   * Decides a pending request in one transaction: the request row is locked (two admins cannot
   * both decide it), the role only changes from `user` (a role changed meanwhile, e.g. admin by
   * CLI, is kept), the user gets an in-app news item, and the decision is audited.
   */
  async decide(
    requestId: number,
    actorId: string,
    decision: 'approve' | 'reject',
    note: string | null,
    now: Date,
  ): Promise<DecisionResult> {
    return this.db.transaction(async (tx) => {
      const rows = await tx
        .select({ userId: analystRequests.userId, status: analystRequests.status })
        .from(analystRequests)
        .where(eq(analystRequests.id, requestId))
        .for('update');
      const request = rows[0];
      if (request === undefined) return { ok: false, why: 'not_found' };
      if (request.status !== 'pending') return { ok: false, why: 'decided' };
      if (request.userId === actorId) return { ok: false, why: 'self' };
      const approve = decision === 'approve';
      await tx
        .update(analystRequests)
        .set({
          status: approve ? 'approved' : 'rejected',
          decidedBy: actorId,
          decidedAt: now,
          note: approve ? null : note,
        })
        .where(eq(analystRequests.id, requestId));
      if (approve) {
        await tx
          .update(users)
          .set({ role: 'analyst' })
          .where(and(eq(users.id, request.userId), eq(users.role, 'user')));
      }
      await tx
        .insert(notifications)
        .values({
          userId: request.userId,
          kind: 'role_decision',
          dataDate: wibDay(now),
          title: approve ? 'Peran Analis disetujui' : 'Pengajuan peran Analis belum disetujui',
          body: approve
            ? 'Anda kini bisa mengunduh data harga dan prediksi (CSV) di Mode Analis.'
            : note === null
              ? 'Anda bisa mengajukan lagi dari halaman akun.'
              : `Catatan admin: ${note}`,
          // Plain path: the link CHECK (Fase 2B) allows no fragment.
          link: approve ? '/analis' : '/akun',
        })
        .onConflictDoNothing();
      await tx.insert(auditLog).values({
        actorId,
        action: approve ? 'role_approve' : 'role_reject',
        target: `analyst_request:${String(requestId)}`,
      });
      const email = await tx
        .select({ email: users.email })
        .from(users)
        .where(eq(users.id, request.userId));
      return { ok: true, email: email[0]?.email ?? '' };
    });
  }

  /**
   * Returns an analyst to a plain user (task 4). Never the admin's own account or another admin
   * (`protected`): admin is changed only by CLI. Same row lock as the CLI and the request flow.
   */
  async revokeAnalyst(userId: string, actorId: string): Promise<RevokeResult> {
    return this.db.transaction(async (tx) => {
      const rows = await tx
        .select({ role: users.role })
        .from(users)
        .where(eq(users.id, userId))
        .for('update');
      const user = rows[0];
      if (user === undefined) return 'not_found';
      if (userId === actorId || user.role === 'admin') return 'protected';
      if (user.role !== 'analyst') return 'not_analyst';
      await tx.update(users).set({ role: 'user' }).where(eq(users.id, userId));
      await tx
        .insert(auditLog)
        .values({ actorId, action: 'role_revoke', target: `user:${userId}` });
      return 'revoked';
    });
  }

  /** The 20 latest ingest runs, newest first (task 5). */
  async ingestRuns(): Promise<(typeof ingestRuns.$inferSelect)[]> {
    return this.db.select().from(ingestRuns).orderBy(desc(ingestRuns.id)).limit(20);
  }

  /** The 20 latest forecast bundles, newest first (task 5). */
  async bundles(): Promise<(typeof forecastArtifacts.$inferSelect)[]> {
    return this.db.select().from(forecastArtifacts).orderBy(desc(forecastArtifacts.id)).limit(20);
  }
}
