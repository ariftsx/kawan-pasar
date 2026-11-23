import { and, eq } from 'drizzle-orm';
import type { Db } from '../database/client.js';
import { analystRequests, auditLog, users } from '../database/schema/index.js';

export type GrantResult = 'granted' | 'removed' | 'unchanged' | 'not_found' | 'refused_admin';

/**
 * Sets a user's role to analyst or back to user, from the server (CLI). An admin is never
 * changed here, and admin is never granted here. Approves a pending request on grant, and
 * records the change in audit_log (no actor: the server operator).
 */
export async function grantRole(
  db: Db,
  email: string,
  role: 'analyst' | 'user',
): Promise<GrantResult> {
  return db.transaction(async (tx) => {
    const rows = await tx
      .select({ id: users.id, role: users.role })
      .from(users)
      .where(eq(users.email, email))
      .limit(1)
      // Same lock as AnalystRepository.createRequest: no request can slip in mid-grant.
      .for('update');
    const user = rows[0];
    if (user === undefined) return 'not_found';
    if (user.role === 'admin') return 'refused_admin';
    if (user.role === role) return 'unchanged';
    await tx.update(users).set({ role }).where(eq(users.id, user.id));
    if (role === 'analyst') {
      await tx
        .update(analystRequests)
        .set({ status: 'approved', decidedAt: new Date() })
        .where(and(eq(analystRequests.userId, user.id), eq(analystRequests.status, 'pending')));
    }
    await tx.insert(auditLog).values({
      actorId: null,
      action: role === 'analyst' ? 'role_grant' : 'role_revoke',
      target: `user:${user.id}`,
    });
    return role === 'analyst' ? 'granted' : 'removed';
  });
}
