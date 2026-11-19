import { sql } from 'drizzle-orm';
import { bigint, check, index, pgTable, smallint, timestamp, uuid } from 'drizzle-orm/pg-core';
import { bytea } from './custom-types.js';
import { whatsappMessageKind, whatsappStatus } from './enums.js';
import { users } from './users.js';

/**
 * The WhatsApp channel of an account (Fase 2C). The number itself is not copied: it stays
 * encrypted in `users`; the channel keeps only the HMAC of the number it was verified for, so a
 * changed number never inherits a verification, and inbound messages (STOP) can be matched.
 */
export const whatsappChannels = pgTable(
  'whatsapp_channels',
  {
    userId: uuid()
      .primaryKey()
      .references(() => users.id, { onDelete: 'cascade' }),
    status: whatsappStatus().notNull(),
    phoneHmac: bytea().notNull(),
    /** HMAC(AUTH_SECRET, user id + code); never the code. Null once used or replaced. */
    codeHash: bytea(),
    codeExpiresAt: timestamp({ withTimezone: true }),
    codeAttempts: smallint().notNull().default(0),
    verifiedAt: timestamp({ withTimezone: true }),
    stoppedAt: timestamp({ withTimezone: true }),
    updatedAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index('whatsapp_channels_phone_hmac_idx').on(t.phoneHmac),
    check('whatsapp_channels_hmac_length', sql`octet_length(${t.phoneHmac}) = 32`),
    check('whatsapp_channels_attempts', sql`${t.codeAttempts} BETWEEN 0 AND 5`),
  ],
);

/**
 * One row per message sent to a phone (no text, no number): the send limits count these.
 * `phone_hmac` lets the per-number code limit hold across accounts. Kept 30 days.
 */
export const whatsappMessages = pgTable(
  'whatsapp_messages',
  {
    id: bigint({ mode: 'number' }).primaryKey().generatedAlwaysAsIdentity(),
    userId: uuid().references(() => users.id, { onDelete: 'set null' }),
    phoneHmac: bytea().notNull(),
    kind: whatsappMessageKind().notNull(),
    createdAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index('whatsapp_messages_user_idx').on(t.userId, t.createdAt),
    index('whatsapp_messages_phone_idx').on(t.phoneHmac, t.createdAt),
    index('whatsapp_messages_created_idx').on(t.createdAt),
  ],
);
