import { sql } from 'drizzle-orm';
import { check, pgTable, smallint, text } from 'drizzle-orm/pg-core';
import { modelCoverage } from './enums.js';

export const commodities = pgTable(
  'commodities',
  {
    id: smallint().primaryKey().generatedAlwaysAsIdentity(),
    code: text().notNull().unique(),
    name: text().notNull(),
    /** PIHPS `comcat_id`; NULL while the commodity has no source data. */
    sourceRef: text().unique(),
    unit: text().notNull().default('kg'),
    modelCoverage: modelCoverage().notNull(),
    sortOrder: smallint().notNull().unique(),
  },
  (t) => [
    check('commodities_code_format', sql`${t.code} ~ '^[a-z0-9]+(-[a-z0-9]+)*$'`),
    check('commodities_unit_kg', sql`${t.unit} = 'kg'`),
  ],
);
