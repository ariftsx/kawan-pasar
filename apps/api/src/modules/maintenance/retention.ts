import { lt, or, sql } from 'drizzle-orm';
import type { Db } from '../../database/client.js';
import {
  authEvents,
  authTokens,
  notifications,
  whatsappMessages,
} from '../../database/schema/index.js';

/** Audit events are kept this long (privacy page, design Fase 2 §3). */
export const AUDIT_RETENTION_DAYS = 90;
/** In-app news is kept this long (privacy page, Fase 2B). */
export const NOTIFICATION_RETENTION_DAYS = 180;
/** The WhatsApp send log (no text, no number) only serves the send limits: 30 days. */
export const WHATSAPP_LOG_RETENTION_DAYS = 30;
/** Role decisions and downloads (Fase 3): one year (fixed in prune_audit_log(), migration 0010). */
export const AUDIT_LOG_RETENTION_DAYS = 365;
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
): Promise<{
  events: number;
  tokens: number;
  notifications: number;
  whatsapp: number;
  audit: number;
}> {
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
  const news = await db
    .delete(notifications)
    .where(
      lt(notifications.createdAt, new Date(now.getTime() - NOTIFICATION_RETENTION_DAYS * DAY_MS)),
    )
    .returning({ id: notifications.id });
  const wa = await db
    .delete(whatsappMessages)
    .where(
      lt(
        whatsappMessages.createdAt,
        new Date(now.getTime() - WHATSAPP_LOG_RETENTION_DAYS * DAY_MS),
      ),
    )
    .returning({ id: whatsappMessages.id });
  // audit_log is append-only for the app; a definer function removes only year-old entries.
  const pruned = await db.execute<{ n: number }>(sql`SELECT prune_audit_log() AS n`);
  return {
    audit: pruned.rows[0]?.n ?? 0,
    events: events.length,
    tokens: tokens.length,
    notifications: news.length,
    whatsapp: wa.length,
  };
}
