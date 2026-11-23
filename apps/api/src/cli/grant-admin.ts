import { and, eq } from 'drizzle-orm';
import type { Db } from '../database/client.js';
import { analystRequests, auditLog, users } from '../database/schema/index.js';

export type AdminResult = 'granted' | 'revoked' | 'unchanged' | 'not_found';

/**
 * Makes an account admin, or returns an admin to a plain user (Fase 3B). Server only: the web
 * can never grant or remove admin. A pending analyst request is closed as approved on grant
 * (admin includes analyst access). The user row is locked like in grantRole and createRequest.
 */
export async function grantAdmin(
  db: Db,
  email: string,
  action: 'grant' | 'revoke',
): Promise<AdminResult> {
  return db.transaction(async (tx) => {
    const rows = await tx
      .select({ id: users.id, role: users.role })
      .from(users)
      .where(eq(users.email, email))
      .limit(1)
      .for('update');
    const user = rows[0];
    if (user === undefined) return 'not_found';
    const isAdmin = user.role === 'admin';
    if (action === 'grant' ? isAdmin : !isAdmin) return 'unchanged';
    await tx
      .update(users)
      .set({ role: action === 'grant' ? 'admin' : 'user' })
      .where(eq(users.id, user.id));
    if (action === 'grant') {
      await tx
        .update(analystRequests)
        .set({ status: 'approved', decidedAt: new Date() })
        .where(and(eq(analystRequests.userId, user.id), eq(analystRequests.status, 'pending')));
    }
    await tx.insert(auditLog).values({
      actorId: null,
      action: action === 'grant' ? 'admin_grant' : 'admin_revoke',
      target: `user:${user.id}`,
    });
    return action === 'grant' ? 'granted' : 'revoked';
  });
}
