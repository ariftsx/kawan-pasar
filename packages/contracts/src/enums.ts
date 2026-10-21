// Controlled vocabularies (docs 08 §4). Values are wire values; never translate them.
import { z } from 'zod';

export const Availability = z.enum([
  'available',
  'partial',
  'missing',
  'insufficient_coverage',
  'temporally_invalid',
  'schema_invalid',
  'stale',
]);

export const ArtifactStatus = z.enum([
  'draft',
  'candidate',
  'validated',
  'published',
  'deprecated',
  'archived',
]);

export const ForecastStatus = z.enum(['pending', 'generated', 'validated', 'published', 'failed']);

export const AlertType = z.enum(['movement_q95', 'forecast_delta', 'cost_delta']);

/** `whatsapp` stays out until HOLD H-01 is lifted. */
export const Channel = z.enum(['in_app', 'web_push', 'email', 'telegram']);

export const Role = z.enum(['user', 'analyst', 'admin']);

export const PriceStatus = z.enum(['available', 'stale', 'missing', 'coming_soon']);

export const CostCompleteness = z.enum(['complete', 'partial']);

export const OutlookStatus = z.enum([
  'available',
  'not_modeled',
  'missing',
  'stale',
  'candidate',
  'in_development',
]);

export const ThresholdStatus = z.enum(['available', 'insufficient_coverage']);

export const QuantityUnit = z.enum(['g', 'kg', 'ml', 'l', 'butir']);
export const PriceUnit = z.enum(['kg', 'l', 'butir']);

/** Reference market codes (docs 05 §3). */
export const MarketCode = z.enum(['PIKJ', 'PIBC']);

/** The forecast horizons the research contract publishes (days). */
export const HORIZON_DAYS = [1, 3, 7, 14, 30, 90, 180, 365] as const;
export const HorizonDay = z.union(HORIZON_DAYS.map((day) => z.literal(day)));

export type Availability = z.infer<typeof Availability>;
export type ArtifactStatus = z.infer<typeof ArtifactStatus>;
export type OutlookStatus = z.infer<typeof OutlookStatus>;
export type PriceStatus = z.infer<typeof PriceStatus>;
export type HorizonDay = z.infer<typeof HorizonDay>;
