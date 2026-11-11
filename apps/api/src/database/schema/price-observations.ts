import { sql } from 'drizzle-orm';
import {
  bigint,
  check,
  date,
  integer,
  pgTable,
  smallint,
  timestamp,
  unique,
} from 'drizzle-orm/pg-core';
import { commodities } from './commodities.js';
import { priceSource } from './enums.js';
import { ingestRuns } from './ingest-runs.js';
import { markets } from './markets.js';

export const priceObservations = pgTable(
  'price_observations',
  {
    id: bigint({ mode: 'number' }).primaryKey().generatedAlwaysAsIdentity(),
    marketId: smallint()
      .notNull()
      .references(() => markets.id),
    commodityId: smallint()
      .notNull()
      .references(() => commodities.id),
    observedOn: date({ mode: 'string' }).notNull(),
    /** Whole rupiah per kg. A missing observation is a missing row, never 0. */
    priceIdr: integer().notNull(),
    source: priceSource().notNull(),
    ingestRunId: bigint({ mode: 'number' }).references(() => ingestRuns.id),
    createdAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    // Also the read index: (market, commodity) equality + observed_on range/order.
    unique('price_observations_market_commodity_day').on(t.marketId, t.commodityId, t.observedOn),
    check('price_observations_price_positive', sql`${t.priceIdr} > 0`),
  ],
);
