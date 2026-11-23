import { sql } from 'drizzle-orm';
import {
  bigint,
  check,
  integer,
  pgTable,
  smallint,
  text,
  timestamp,
  unique,
  uuid,
} from 'drizzle-orm/pg-core';
import { articleCategory } from './enums.js';
import { users } from './users.js';

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
    /** Fase 3B: bumped on every save; a save names the revision it edited (409 when stale). */
    revision: integer().notNull().default(1),
    updatedBy: uuid().references(() => users.id, { onDelete: 'set null' }),
  },
  (t) => [
    check('articles_slug_format', sql`${t.slug} ~ '^[a-z0-9]+(-[a-z0-9]+)*$'`),
    check('articles_reading_minutes_positive', sql`${t.readingMinutes} > 0`),
    check('articles_body_size', sql`length(${t.bodyMd}) <= 100000`),
  ],
);

/**
 * Every saved version of an article (Fase 3B), so an edit can always be undone. The article row
 * holds the current version; a restore copies a revision back as a new save.
 */
export const articleRevisions = pgTable(
  'article_revisions',
  {
    id: bigint({ mode: 'number' }).primaryKey().generatedAlwaysAsIdentity(),
    articleId: bigint({ mode: 'number' })
      .notNull()
      .references(() => articles.id, { onDelete: 'cascade' }),
    revision: integer().notNull(),
    category: articleCategory().notNull(),
    title: text().notNull(),
    summary: text().notNull(),
    bodyMd: text().notNull(),
    readingMinutes: smallint().notNull(),
    createdBy: uuid().references(() => users.id, { onDelete: 'set null' }),
    createdAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    unique('article_revisions_article_revision').on(t.articleId, t.revision),
    check('article_revisions_body_size', sql`length(${t.bodyMd}) <= 100000`),
  ],
);
