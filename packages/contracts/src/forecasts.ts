import { z } from 'zod';
import {
  Change,
  CommodityCodeSchema,
  HorizonSchema,
  IsoDate,
  IsoDateTime,
  ModelCoverageSchema,
  PriceIdr,
} from './common.js';
import { MarketSchema } from './markets.js';

export const ForecastStatusSchema = z.enum([
  'available',
  'expired',
  'hidden',
  'unavailable',
  'pending_coverage',
]);
export type ForecastStatus = z.infer<typeof ForecastStatusSchema>;

export const EvalStatusSchema = z.enum(['available', 'partial', 'not_tested']);
export type EvalStatus = z.infer<typeof EvalStatusSchema>;

export const ForecastArtifactSchema = z.strictObject({
  modelName: z.string().min(1),
  modelVersion: z.string().min(1),
  dataVersion: z.string().min(1),
  preprocessVersion: z.string().min(1),
  dataCutoff: IsoDateTime,
  issuedAt: IsoDateTime,
  isDemo: z.boolean(),
  ageDays: z.int().nonnegative(),
});
export type ForecastArtifact = z.infer<typeof ForecastArtifactSchema>;

export const ForecastHorizonSchema = z.strictObject({
  horizonDays: HorizonSchema,
  targetDate: IsoDate,
  q10Change: Change.nullable(),
  q50Change: Change.nullable(),
  q90Change: Change.nullable(),
  q10PriceIdr: PriceIdr.nullable(),
  q50PriceIdr: PriceIdr.nullable(),
  q90PriceIdr: PriceIdr.nullable(),
  evalStatus: EvalStatusSchema,
});
export type ForecastHorizon = z.infer<typeof ForecastHorizonSchema>;

export const ForecastResponseSchema = z.strictObject({
  market: MarketSchema,
  commodity: z.strictObject({
    code: CommodityCodeSchema,
    name: z.string(),
    modelCoverage: ModelCoverageSchema,
  }),
  status: ForecastStatusSchema,
  artifact: ForecastArtifactSchema.nullable(),
  baseDate: IsoDate.nullable(),
  basePriceIdr: PriceIdr.nullable(),
  horizons: z.array(ForecastHorizonSchema),
});
export type ForecastResponse = z.infer<typeof ForecastResponseSchema>;
