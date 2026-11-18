import { sql } from 'drizzle-orm';
import { bigint, check, index, pgTable, timestamp, uuid } from 'drizzle-orm/pg-core';
import { bytea } from './custom-types.js';
import { authTokenPurpose } from './enums.js';
import { users } from './users.js';

/** Single-use tokens sent by e-mail. Only the SHA-256 of a token is stored. */
export const authTokens = pgTable(
  'auth_tokens',
  {
    id: bigint({ mode: 'number' }).primaryKey().generatedAlwaysAsIdentity(),
    userId: uuid()
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    purpose: authTokenPurpose().notNull(),
    tokenHash: bytea().notNull().unique(),
    expiresAt: timestamp({ withTimezone: true }).notNull(),
    usedAt: timestamp({ withTimezone: true }),
    createdAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index('auth_tokens_user_purpose_idx').on(t.userId, t.purpose),
    check('auth_tokens_hash_length', sql`octet_length(${t.tokenHash}) = 32`),
  ],
);
