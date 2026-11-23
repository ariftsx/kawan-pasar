import { sql } from 'drizzle-orm';
import { bigint, boolean, check, pgTable, text, timestamp, uniqueIndex } from 'drizzle-orm/pg-core';
import { artifactStatus } from './enums.js';

export const forecastArtifacts = pgTable(
  'forecast_artifacts',
  {
    id: bigint({ mode: 'number' }).primaryKey().generatedAlwaysAsIdentity(),
    bundleId: text().notNull().unique(),
    modelName: text().notNull(),
    modelVersion: text().notNull(),
    dataVersion: text().notNull(),
    preprocessVersion: text().notNull(),
    dataCutoff: timestamp({ withTimezone: true }).notNull(),
    issuedAt: timestamp({ withTimezone: true }).notNull(),
    checksumSha256: text().notNull(),
    status: artifactStatus().notNull().default('pending'),
    isDemo: boolean().notNull().default(false),
    /** Fase 3B: why a bundle was rejected (verifier codes), shown on the admin monitoring page. */
    rejectReasons: text().array(),
    createdAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    check('forecast_artifacts_checksum_hex', sql`${t.checksumSha256} ~ '^[0-9a-f]{64}$'`),
    check(
      'forecast_artifacts_versions_present',
      sql`length(${t.modelVersion}) > 0 AND length(${t.dataVersion}) > 0 AND length(${t.preprocessVersion}) > 0`,
    ),
    uniqueIndex('forecast_artifacts_one_active_per_model')
      .on(t.modelName)
      .where(sql`${t.status} = 'active'`),
  ],
);
