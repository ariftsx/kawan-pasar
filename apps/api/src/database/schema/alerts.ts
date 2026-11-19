import { sql } from 'drizzle-orm';
import {
  bigint,
  boolean,
  check,
  date,
  index,
  integer,
  pgTable,
  smallint,
  text,
  timestamp,
  unique,
  uuid,
} from 'drizzle-orm/pg-core';
import { commodities } from './commodities.js';
import { alertDirection, notificationKind } from './enums.js';
import { markets } from './markets.js';
import { users } from './users.js';

/**
 * What a user wants to hear about (Fase 2B, prototype d_peringatan): the channels and the three
 * rules are switches per user. A row exists once the user saved them; until then the defaults
 * apply (AlertsRepository.DEFAULT_PREFERENCES).
 */
export const alertPreferences = pgTable('alert_preferences', {
  userId: uuid()
    .primaryKey()
    .references(() => users.id, { onDelete: 'cascade' }),
  inApp: boolean().notNull().default(true),
  weekly: boolean().notNull().default(false),
  unusualMove: boolean().notNull().default(true),
  forecastRise: boolean().notNull().default(true),
  priceThreshold: boolean().notNull().default(true),
  /** WhatsApp (Fase 2C): used only once the channel is verified. */
  whatsapp: boolean().notNull().default(true),
  updatedAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
});

/** The commodities a user watches, with an optional own price limit (rule "price_threshold"). */
export const alertWatches = pgTable(
  'alert_watches',
  {
    id: bigint({ mode: 'number' }).primaryKey().generatedAlwaysAsIdentity(),
    userId: uuid()
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    marketId: smallint()
      .notNull()
      .references(() => markets.id),
    commodityId: smallint()
      .notNull()
      .references(() => commodities.id),
    thresholdIdr: integer(),
    direction: alertDirection(),
    createdAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    unique('alert_watches_user_market_commodity').on(t.userId, t.marketId, t.commodityId),
    // Evaluation reads every watch of one (market, commodity) at a time.
    index('alert_watches_market_commodity_idx').on(t.marketId, t.commodityId),
    check(
      'alert_watches_threshold',
      sql`(${t.thresholdIdr} IS NULL AND ${t.direction} IS NULL) OR (${t.thresholdIdr} BETWEEN 1 AND 10000000 AND ${t.direction} IS NOT NULL)`,
    ),
  ],
);

/**
 * In-app news ("kabar"). One per (user, kind, commodity, data date): the idempotency key, so a
 * repeated import or evaluation never sends the same news twice. Weekly summaries use the
 * Monday of their week as data date and no commodity. Kept 180 days (privacy page).
 */
export const notifications = pgTable(
  'notifications',
  {
    id: bigint({ mode: 'number' }).primaryKey().generatedAlwaysAsIdentity(),
    userId: uuid()
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    kind: notificationKind().notNull(),
    marketId: smallint().references(() => markets.id),
    commodityId: smallint().references(() => commodities.id),
    dataDate: date({ mode: 'string' }).notNull(),
    title: text().notNull(),
    body: text().notNull(),
    /** Relative path in the product (e.g. /prediksi/cabai-merah-keriting); never a full URL. */
    link: text(),
    modelVersion: text(),
    /** When it also went out by WhatsApp (Fase 2C); null = app only. */
    sentWhatsappAt: timestamp({ withTimezone: true }),
    readAt: timestamp({ withTimezone: true }),
    createdAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    unique('notifications_once').on(t.userId, t.kind, t.commodityId, t.dataDate).nullsNotDistinct(),
    index('notifications_user_created_idx').on(t.userId, t.createdAt.desc(), t.id.desc()),
    index('notifications_unread_idx')
      .on(t.userId)
      .where(sql`${t.readAt} IS NULL`),
    index('notifications_created_idx').on(t.createdAt),
    check('notifications_title_length', sql`length(${t.title}) BETWEEN 1 AND 160`),
    check('notifications_body_length', sql`length(${t.body}) BETWEEN 1 AND 1200`),
    // A product path: the character after '/' is a letter or digit ('//host' leaves the site).
    check(
      'notifications_link_relative',
      sql`${t.link} IS NULL OR ${t.link} ~ '^/[a-z0-9][a-z0-9/?=&._-]*$'`,
    ),
  ],
);
