import { bigint, index, pgTable, timestamp, uuid } from 'drizzle-orm/pg-core';
import { bytea } from './custom-types.js';
import { authEventType } from './enums.js';
import { users } from './users.js';

/**
 * Audit trail of account events. Never holds an e-mail address, password or token; the client
 * IP only as a keyed hash. Kept when the user is deleted, without the user (UU PDP).
 */
export const authEvents = pgTable(
  'auth_events',
  {
    id: bigint({ mode: 'number' }).primaryKey().generatedAlwaysAsIdentity(),
    userId: uuid().references(() => users.id, { onDelete: 'set null' }),
    type: authEventType().notNull(),
    ipHash: bytea(),
    createdAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index('auth_events_created_at_idx').on(t.createdAt),
    // Deleting a user nulls its events: the index keeps that from scanning the audit table.
    index('auth_events_user_idx').on(t.userId),
  ],
);
