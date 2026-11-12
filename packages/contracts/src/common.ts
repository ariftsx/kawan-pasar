import { COMMODITIES, HORIZONS, MARKETS } from '@kawan-pasar/catalog';
import type { CommodityCode, MarketCode } from '@kawan-pasar/catalog';
import { z } from 'zod';

const marketCodes = MARKETS.map((m) => m.code) as [MarketCode, ...MarketCode[]];
const commodityCodes = COMMODITIES.map((c) => c.code) as [CommodityCode, ...CommodityCode[]];

/** Calendar day `YYYY-MM-DD` (Asia/Jakarta). */
export const IsoDate = z.iso.date();
/** ISO-8601 timestamp with offset. */
export const IsoDateTime = z.iso.datetime({ offset: true });

export const MarketCodeSchema = z.enum(marketCodes);
export const CommodityCodeSchema = z.enum(commodityCodes);
export const HorizonSchema = z.literal([...HORIZONS]);
export const ModelCoverageSchema = z.enum(['covered', 'pending']);

/** Whole rupiah per kg. Unknown prices are `null` at the call site, never 0. */
export const PriceIdr = z.int().positive();

/** Relative change as a fraction (0.032 = 3.2 %). Zod 4 numbers reject NaN/Infinity. */
export const Change = z.number();

export const PricePointSchema = z.strictObject({ observedOn: IsoDate, priceIdr: PriceIdr });
export type PricePoint = z.infer<typeof PricePointSchema>;
