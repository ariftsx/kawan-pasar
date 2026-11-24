import { jsonb, pgTable, text, timestamp, uuid } from 'drizzle-orm/pg-core';
import { users } from './users.js';

/**
 * Settings of the retraining pipeline chosen by an admin (Fase 4C), e.g. the retraining schedule
 * preset. Read by the DAGs through the internal API; every change is in audit_log.
 */
export const pipelineSettings = pgTable('pipeline_settings', {
  key: text().primaryKey(),
  value: jsonb().$type<unknown>().notNull(),
  updatedBy: uuid().references(() => users.id, { onDelete: 'set null' }),
  updatedAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
});
