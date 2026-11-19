import { sql } from 'drizzle-orm';
import { check, index, pgTable, text, timestamp, uuid } from 'drizzle-orm/pg-core';
import { bytea, citext } from './custom-types.js';
import { userRole } from './enums.js';

/**
 * Registered users (Fase 2A). Only what an account needs (UU PDP): no name. The optional mobile
 * number (Fase 2B) is stored encrypted (AES-256-GCM, see PhoneCipher) with an HMAC for lookups.
 */
export const users = pgTable(
  'users',
  {
    // Time-ordered (PostgreSQL 18 `uuidv7()`): good index locality, no enumerable sequence.
    id: uuid()
      .primaryKey()
      .default(sql`uuidv7()`),
    email: citext().notNull().unique(),
    passwordHash: text().notNull(),
    emailVerifiedAt: timestamp({ withTimezone: true }),
    role: userRole().notNull().default('user'),
    passwordChangedAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
    createdAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
    phoneNonce: bytea(),
    phoneCiphertext: bytea(),
    phoneHmac: bytea(),
  },
  (t) => [
    check('users_email_length', sql`length(${t.email}) <= 254`),
    check('users_password_hash_argon2id', sql`${t.passwordHash} LIKE '$argon2id$%'`),
    check(
      'users_phone_complete',
      sql`(${t.phoneNonce} IS NULL AND ${t.phoneCiphertext} IS NULL AND ${t.phoneHmac} IS NULL) OR (octet_length(${t.phoneNonce}) = 12 AND octet_length(${t.phoneCiphertext}) BETWEEN 17 AND 64 AND octet_length(${t.phoneHmac}) = 32)`,
    ),
    index('users_phone_hmac_idx').on(t.phoneHmac),
  ],
);
