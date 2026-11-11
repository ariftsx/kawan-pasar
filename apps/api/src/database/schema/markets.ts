import { sql } from 'drizzle-orm';
import { check, pgTable, smallint, text } from 'drizzle-orm/pg-core';
import { marketStatus } from './enums.js';

export const markets = pgTable(
  'markets',
  {
    id: smallint().primaryKey().generatedAlwaysAsIdentity(),
    code: text().notNull().unique(),
    name: text().notNull(),
    city: text().notNull(),
    status: marketStatus().notNull(),
  },
  (t) => [check('markets_code_format', sql`${t.code} ~ '^[A-Z]{4}$'`)],
);
