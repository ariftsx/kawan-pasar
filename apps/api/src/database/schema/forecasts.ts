import { sql } from 'drizzle-orm';
import {
  bigint,
  check,
  date,
  integer,
  numeric,
  pgTable,
  smallint,
  unique,
} from 'drizzle-orm/pg-core';
import { HORIZONS } from '@kawan-pasar/catalog';
import { commodities } from './commodities.js';
import { evalStatus } from './enums.js';
import { forecastArtifacts } from './forecast-artifacts.js';
import { markets } from './markets.js';

const change = (): ReturnType<typeof numeric> => numeric({ precision: 9, scale: 6 });

export const forecasts = pgTable(
  'forecasts',
  {
    id: bigint({ mode: 'number' }).primaryKey().generatedAlwaysAsIdentity(),
    artifactId: bigint({ mode: 'number' })
      .notNull()
      .references(() => forecastArtifacts.id, { onDelete: 'cascade' }),
    marketId: smallint()
      .notNull()
      .references(() => markets.id),
    commodityId: smallint()
      .notNull()
      .references(() => commodities.id),
    baseDate: date({ mode: 'string' }).notNull(),
    horizonDays: smallint().notNull(),
    q10Change: change(),
    q50Change: change(),
    q90Change: change(),
    q10PriceIdr: integer(),
    q50PriceIdr: integer(),
    q90PriceIdr: integer(),
    evalStatus: evalStatus().notNull(),
  },
  (t) => [
    unique('forecasts_artifact_market_commodity_horizon').on(
      t.artifactId,
      t.marketId,
      t.commodityId,
      t.horizonDays,
    ),
    check('forecasts_horizon_allowed', sql`${t.horizonDays} IN (${sql.raw(HORIZONS.join(', '))})`),
    check(
      'forecasts_change_monotonic',
      sql`${t.q10Change} <= ${t.q50Change} AND ${t.q50Change} <= ${t.q90Change}`,
    ),
    check(
      'forecasts_price_monotonic',
      sql`${t.q10PriceIdr} <= ${t.q50PriceIdr} AND ${t.q50PriceIdr} <= ${t.q90PriceIdr}`,
    ),
    check(
      'forecasts_price_positive',
      sql`${t.q10PriceIdr} > 0 AND ${t.q50PriceIdr} > 0 AND ${t.q90PriceIdr} > 0`,
    ),
  ],
);
