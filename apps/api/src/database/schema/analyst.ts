import { sql } from 'drizzle-orm';
import {
  bigint,
  check,
  index,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from 'drizzle-orm/pg-core';
import { analystRequestStatus, auditAction } from './enums.js';
import { users } from './users.js';

/**
 * Requests for the Analyst role (Fase 3A): unlocks the CSV downloads of Mode Analis. Decided by
 * an admin (3B; until then by CLI). One open request per user (partial unique index).
 */
export const analystRequests = pgTable(
  'analyst_requests',
  {
    id: bigint({ mode: 'number' }).primaryKey().generatedAlwaysAsIdentity(),
    userId: uuid()
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    reason: text().notNull(),
    organization: text(),
    status: analystRequestStatus().notNull().default('pending'),
    decidedBy: uuid().references(() => users.id, { onDelete: 'set null' }),
    decidedAt: timestamp({ withTimezone: true }),
    /** Shown to the requester when rejected; never personal data of others. */
    note: text(),
    createdAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    uniqueIndex('analyst_requests_one_pending')
      .on(t.userId)
      .where(sql`${t.status} = 'pending'`),
    index('analyst_requests_status_idx').on(t.status, t.createdAt),
    check('analyst_requests_reason_length', sql`length(${t.reason}) BETWEEN 10 AND 500`),
    check(
      'analyst_requests_org_length',
      sql`${t.organization} IS NULL OR length(${t.organization}) <= 120`,
    ),
    check('analyst_requests_note_length', sql`${t.note} IS NULL OR length(${t.note}) <= 500`),
  ],
);

/**
 * Who did what to what (Fase 3): role decisions, downloads, admin actions. Ids only, never an
 * e-mail address, a phone number or the content of an article. Kept one year.
 */
export const auditLog = pgTable(
  'audit_log',
  {
    id: bigint({ mode: 'number' }).primaryKey().generatedAlwaysAsIdentity(),
    actorId: uuid().references(() => users.id, { onDelete: 'set null' }),
    action: auditAction().notNull(),
    /** E.g. a user id, an analyst request id, an article slug, or an export kind. */
    target: text(),
    createdAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index('audit_log_created_idx').on(t.createdAt),
    index('audit_log_actor_idx').on(t.actorId),
    check('audit_log_target_length', sql`${t.target} IS NULL OR length(${t.target}) <= 200`),
  ],
);
