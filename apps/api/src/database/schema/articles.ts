import { sql } from 'drizzle-orm';
import { bigint, check, pgTable, smallint, text, timestamp } from 'drizzle-orm/pg-core';
import { articleCategory } from './enums.js';

export const articles = pgTable(
  'articles',
  {
    id: bigint({ mode: 'number' }).primaryKey().generatedAlwaysAsIdentity(),
    slug: text().notNull().unique(),
    category: articleCategory().notNull(),
    title: text().notNull(),
    summary: text().notNull(),
    bodyMd: text().notNull(),
    readingMinutes: smallint().notNull(),
    /** Display order within the education pages (ascending). */
    sortOrder: smallint().notNull().default(0),
    publishedAt: timestamp({ withTimezone: true }),
    updatedAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    check('articles_slug_format', sql`${t.slug} ~ '^[a-z0-9]+(-[a-z0-9]+)*$'`),
    check('articles_reading_minutes_positive', sql`${t.readingMinutes} > 0`),
    check('articles_body_size', sql`length(${t.bodyMd}) <= 100000`),
  ],
);
