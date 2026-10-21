// Prices, forecasts, thresholds, and alerts (docs 08 §5.1, §5.3–5.5).
import { z } from 'zod';

import {
  AlertType,
  Channel,
  ForecastStatus,
  HorizonDay,
  MarketCode,
  PriceUnit,
  ThresholdStatus,
} from './enums.js';
import { ChangeRatio, MarketDate, Rupiah, Slug, Timestamp, prefixedId } from './primitives.js';

export const PriceObservation = z.strictObject({
  commodity: Slug,
  market: MarketCode,
  observed_at: MarketDate,
  /** When the value really reached us; a forecast at origin t may use it only if ≤ t. */
  available_at: Timestamp,
  price_idr: Rupiah.positive(),
  unit: PriceUnit,
  source: z.enum(['pihps']),
  status: z.enum(['valid', 'quarantined']),
});

export const ForecastRun = z.strictObject({
  id: prefixedId('fr'),
  commodity: Slug,
  market: MarketCode,
  origin: MarketDate,
  model_version: z.string().min(1),
  dataset_version: z.string().min(1),
  preprocessing_version: z.string().min(1),
  data_cutoff: Timestamp,
  /** Pipeline state of the run. Publication state lives in `provenance.artifact_status`. */
  status: ForecastStatus,
});

export const ForecastPoint = z.strictObject({
  horizon_day: HorizonDay,
  target_date: MarketDate,
  predicted_change: ChangeRatio,
  /** Reconstruction: reference × (1 + predicted_change). */
  predicted_price_idr: Rupiah,
});

export const Forecast = z.strictObject({
  run: ForecastRun,
  reference_price_idr: Rupiah.positive(),
  points: z.array(ForecastPoint).min(1),
});

export const MovementThreshold = z.strictObject({
  commodity: Slug,
  horizon_day: z.literal(7),
  q95_abs_change: z.number().gt(0).lt(1).nullable(),
  method: z.literal('empirical_quantile_linear'),
  n_obs: z.int().nonnegative(),
  window_end: MarketDate.nullable(),
  status: ThresholdStatus,
  version: z.string().regex(/^thr-stat-\d{8}$/),
  source: z.literal('product_price_history'),
});

export const AlertEvent = z.strictObject({
  id: prefixedId('ale'),
  type: AlertType,
  ingredient: Slug,
  fired_for_date: MarketDate,
  payload: z.record(z.string(), z.number().nullable()),
  channels: z.array(Channel).min(1),
  read_at: Timestamp.nullable(),
});

export type PriceObservation = z.infer<typeof PriceObservation>;
export type Forecast = z.infer<typeof Forecast>;
export type MovementThreshold = z.infer<typeof MovementThreshold>;
export type AlertEvent = z.infer<typeof AlertEvent>;
