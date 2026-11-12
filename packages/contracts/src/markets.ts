import { z } from 'zod';
import { MarketCodeSchema } from './common.js';

export const MarketSchema = z.strictObject({
  code: MarketCodeSchema,
  name: z.string().min(1),
  city: z.string().min(1),
  status: z.enum(['available', 'coming_soon']),
});
export type Market = z.infer<typeof MarketSchema>;

export const MarketsResponseSchema = z.strictObject({ items: z.array(MarketSchema) });
export type MarketsResponse = z.infer<typeof MarketsResponseSchema>;

/** Route params shared by every market-scoped endpoint. */
export const MarketParamsSchema = z.strictObject({ market: MarketCodeSchema });
