import { lt, or } from 'drizzle-orm';
import type { Db } from '../../database/client.js';
import { authEvents, authTokens } from '../../database/schema/index.js';

/** Audit events are kept this long (privacy page, design Fase 2 §3). */
export const AUDIT_RETENTION_DAYS = 90;
/** Used or expired e-mail tokens are useless; they go after this grace period. */
const TOKEN_GRACE_DAYS = 1;
const DAY_MS = 86_400_000;

/**
 * Deletes account data past its retention. Idempotent: safe to run on several workers or
 * twice. Both deletes use indexed columns (created_at, and a small table for tokens).
 */
export async function pruneAccountData(
  db: Db,
  now: Date,
): Promise<{ events: number; tokens: number }> {
  const eventCutoff = new Date(now.getTime() - AUDIT_RETENTION_DAYS * DAY_MS);
  const tokenCutoff = new Date(now.getTime() - TOKEN_GRACE_DAYS * DAY_MS);
  const events = await db
    .delete(authEvents)
    .where(lt(authEvents.createdAt, eventCutoff))
    .returning({ id: authEvents.id });
  const tokens = await db
    .delete(authTokens)
    .where(or(lt(authTokens.expiresAt, tokenCutoff), lt(authTokens.usedAt, tokenCutoff)))
    .returning({ id: authTokens.id });
  return { events: events.length, tokens: tokens.length };
}
