import { sql } from 'drizzle-orm';
import {
  bigint,
  boolean,
  check,
  date,
  index,
  jsonb,
  numeric,
  pgTable,
  text,
  timestamp,
  uuid,
} from 'drizzle-orm/pg-core';
import { modelCandidateStatus } from './enums.js';
import { users } from './users.js';

/**
 * Candidate ARIF-Net bundles from the retraining pipeline (Fase 4B): registered by Airflow with
 * the service token, audited and decided by an admin (4C). Nothing here is ever served to the
 * public: only an approved candidate is promoted, through the bundle verifier of Fase 1.
 */
export const modelCandidates = pgTable(
  'model_candidates',
  {
    id: bigint({ mode: 'number' }).primaryKey().generatedAlwaysAsIdentity(),
    runId: text().notNull().unique(),
    bundleId: text().notNull().unique(),
    bundleSha256: text().notNull(),
    modelVersion: text().notNull(),
    dataEnd: date({ mode: 'string' }).notNull(),
    lockOpen: boolean().notNull(),
    commodities: text().array().notNull(),
    overallRelmae: numeric({ precision: 8, scale: 4, mode: 'number' }).notNull(),
    /** {commodity code: {horizon: relMAE}} */
    scores: jsonb().$type<Record<string, Record<string, number>>>().notNull(),
    windowStart: date({ mode: 'string' }).notNull(),
    windowEnd: date({ mode: 'string' }).notNull(),
    status: modelCandidateStatus().notNull().default('pending'),
    decidedBy: uuid().references(() => users.id, { onDelete: 'set null' }),
    decidedAt: timestamp({ withTimezone: true }),
    note: text(),
    createdAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index('model_candidates_status_idx').on(t.status, t.createdAt),
    check('model_candidates_run_id_format', sql`${t.runId} ~ '^[A-Za-z0-9][A-Za-z0-9._-]{0,63}$'`),
    check('model_candidates_bundle_sha_hex', sql`${t.bundleSha256} ~ '^[0-9a-f]{64}$'`),
    check('model_candidates_note_length', sql`${t.note} IS NULL OR length(${t.note}) <= 500`),
  ],
);
