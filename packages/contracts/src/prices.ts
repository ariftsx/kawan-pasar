import { z } from 'zod';
import {
  Change,
  CommodityCodeSchema,
  IsoDate,
  MarketCodeSchema,
  ModelCoverageSchema,
  PricePointSchema,
} from './common.js';
import { ForecastStatusSchema } from './forecasts.js';
import { MarketSchema } from './markets.js';

export const DataStatusSchema = z.enum(['fresh', 'stale', 'no_data']);
export type DataStatus = z.infer<typeof DataStatusSchema>;

export const DirectionSchema = z.enum(['up', 'down', 'flat']);
export type Direction = z.infer<typeof DirectionSchema>;

export const CommoditySummarySchema = z.strictObject({
  code: CommodityCodeSchema,
  name: z.string().min(1),
  unit: z.literal('kg'),
  modelCoverage: ModelCoverageSchema,
  dataStatus: DataStatusSchema,
  latest: PricePointSchema.nullable(),
  change7d: Change.nullable(),
  change30d: Change.nullable(),
  sparkline: z.array(PricePointSchema).max(30),
  forecast7d: z.strictObject({
    status: ForecastStatusSchema,
    q50Change: Change.nullable(),
    direction: DirectionSchema.nullable(),
  }),
});
export type CommoditySummary = z.infer<typeof CommoditySummarySchema>;

export const PriceSummaryResponseSchema = z.strictObject({
  market: MarketSchema,
  latestObservedOn: IsoDate.nullable(),
  items: z.array(CommoditySummarySchema),
});
export type PriceSummaryResponse = z.infer<typeof PriceSummaryResponseSchema>;

export const HistoryRangeSchema = z.enum(['30d', '90d', '365d', 'all']);
export type HistoryRange = z.infer<typeof HistoryRangeSchema>;

export const HistoryQuerySchema = z.strictObject({ range: HistoryRangeSchema.default('90d') });

export const CommodityParamsSchema = z.strictObject({
  market: MarketCodeSchema,
  commodity: CommodityCodeSchema,
});

export const HistoryResponseSchema = z.strictObject({
  market: MarketSchema,
  commodity: z.strictObject({ code: CommodityCodeSchema, name: z.string() }),
  range: HistoryRangeSchema,
  downsampled: z.boolean(),
  points: z.array(PricePointSchema),
});
export type HistoryResponse = z.infer<typeof HistoryResponseSchema>;
