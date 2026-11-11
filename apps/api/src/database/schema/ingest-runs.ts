import { sql } from 'drizzle-orm';
import { bigint, check, integer, pgTable, text, timestamp } from 'drizzle-orm/pg-core';
import { ingestStatus, priceSource } from './enums.js';

export const ingestRuns = pgTable(
  'ingest_runs',
  {
    id: bigint({ mode: 'number' }).primaryKey().generatedAlwaysAsIdentity(),
    source: priceSource().notNull(),
    startedAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
    finishedAt: timestamp({ withTimezone: true }),
    status: ingestStatus().notNull(),
    rowsInserted: integer().notNull().default(0),
    rowsSkipped: integer().notNull().default(0),
    rowsRejected: integer().notNull().default(0),
    error: text(),
  },
  (t) => [
    check(
      'ingest_runs_counts_non_negative',
      sql`${t.rowsInserted} >= 0 AND ${t.rowsSkipped} >= 0 AND ${t.rowsRejected} >= 0`,
    ),
  ],
);
