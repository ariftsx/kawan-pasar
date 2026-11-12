import { z } from 'zod';
import {
  Change,
  CommodityCodeSchema,
  HorizonSchema,
  IsoDate,
  IsoDateTime,
  MarketCodeSchema,
  PriceIdr,
} from './common.js';
import { EvalStatusSchema } from './forecasts.js';

/** `metadata.json` of a forecast bundle (docs/data/kontrak-bundel-prediksi.md). */
export const BundleMetadataSchema = z.strictObject({
  bundle_id: z.string().regex(/^[a-z0-9][a-z0-9._-]{2,120}$/),
  model_name: z.string().min(1).max(64),
  model_version: z.string().min(1).max(64),
  data_version: z.string().min(1).max(64),
  preprocess_version: z.string().min(1).max(64),
  data_cutoff: IsoDateTime,
  issued_at: IsoDateTime,
});
export type BundleMetadata = z.infer<typeof BundleMetadataSchema>;

/** Known quantiles (nulls skipped) must be non-decreasing in q10 → q50 → q90 order. */
const ordered = (...values: (number | null)[]): boolean => {
  const known = values.filter((v): v is number => v !== null);
  return known.every((v, i) => i === 0 || (known[i - 1] ?? v) <= v);
};

/** One row of `forecasts.csv` after CSV cells are converted (empty cell → null). */
export const BundleForecastRowSchema = z
  .strictObject({
    market_code: MarketCodeSchema,
    commodity_code: CommodityCodeSchema,
    base_date: IsoDate,
    horizon_days: HorizonSchema,
    q10_change: Change.nullable(),
    q50_change: Change.nullable(),
    q90_change: Change.nullable(),
    q10_price_idr: PriceIdr.nullable(),
    q50_price_idr: PriceIdr.nullable(),
    q90_price_idr: PriceIdr.nullable(),
    eval_status: EvalStatusSchema,
  })
  .superRefine((r, ctx) => {
    if (!ordered(r.q10_change, r.q50_change, r.q90_change)) {
      ctx.addIssue({
        code: 'custom',
        message: 'change quantiles not monotonic',
        path: ['q50_change'],
      });
    }
    if (!ordered(r.q10_price_idr, r.q50_price_idr, r.q90_price_idr)) {
      ctx.addIssue({
        code: 'custom',
        message: 'price quantiles not monotonic',
        path: ['q50_price_idr'],
      });
    }
  });
export type BundleForecastRow = z.infer<typeof BundleForecastRowSchema>;
