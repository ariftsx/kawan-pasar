import { sql } from 'drizzle-orm';
import { check, pgTable, text, timestamp, uuid } from 'drizzle-orm/pg-core';
import { citext } from './custom-types.js';
import { userRole } from './enums.js';

/** Registered users (Fase 2A). Only what an account needs: no name, no phone (UU PDP). */
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
  },
  (t) => [
    check('users_email_length', sql`length(${t.email}) <= 254`),
    check('users_password_hash_argon2id', sql`${t.passwordHash} LIKE '$argon2id$%'`),
  ],
);
