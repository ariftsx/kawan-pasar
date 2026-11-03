// Market catalog for Kawan Pasar v0.4: the commodities on the price board and the markets that
// carry data. Every price here is DATA DEMO, used only when NEXT_PUBLIC_DATA_MODE=demo.
import { MarketCode } from '@kawan-pasar/contracts';
import { z } from 'zod';

export const COMMODITY_SLUGS = [
  'cabai-merah-keriting',
  'bawang-merah',
  'beras-medium-1',
  'cabai-rawit-hijau',
  'cabai-rawit-merah',
] as const;

export const CommoditySlug = z.enum(COMMODITY_SLUGS);

/** `available`: ARIF-Net forecasts this commodity; `coming_soon`: price only, forecast later. */
export const ForecastSupport = z.enum(['available', 'coming_soon']);

export const Commodity = z.strictObject({
  slug: CommoditySlug,
  name: z.string().min(1),
  unit: z.literal('kg'),
  forecast: ForecastSupport,
  /** Labelled sample price per kg for demo mode; equals the demo bundle reference price. */
  demo_price_idr: z.int().positive(),
});

export const MarketStatus = z.enum(['available', 'coming_soon']);

export const Market = z.strictObject({
  code: MarketCode.nullable(),
  slug: z.string().min(1),
  name: z.string().min(1),
  region: z.string().min(1),
  status: MarketStatus,
});

export type CommoditySlug = z.infer<typeof CommoditySlug>;
export type Commodity = z.infer<typeof Commodity>;
export type Market = z.infer<typeof Market>;

const COMMODITY_SEED: readonly Commodity[] = [
  {
    slug: 'cabai-merah-keriting',
    name: 'Cabai merah keriting',
    unit: 'kg',
    forecast: 'available',
    demo_price_idr: 52_400,
  },
  {
    slug: 'bawang-merah',
    name: 'Bawang merah',
    unit: 'kg',
    forecast: 'available',
    demo_price_idr: 38_933,
  },
  {
    slug: 'beras-medium-1',
    name: 'Beras medium I',
    unit: 'kg',
    forecast: 'available',
    demo_price_idr: 13_650,
  },
  {
    slug: 'cabai-rawit-hijau',
    name: 'Cabai rawit hijau',
    unit: 'kg',
    forecast: 'coming_soon',
    demo_price_idr: 45_200,
  },
  {
    slug: 'cabai-rawit-merah',
    name: 'Cabai rawit merah',
    unit: 'kg',
    forecast: 'coming_soon',
    demo_price_idr: 58_300,
  },
];

const MARKET_SEED: readonly Market[] = [
  {
    code: 'PIKJ',
    slug: 'pasar-kramat-jati',
    name: 'Pasar Kramat Jati',
    region: 'Jakarta Timur',
    status: 'available',
  },
  {
    code: null,
    slug: 'pasar-wilayah-lain',
    name: 'Pasar dan wilayah lain',
    region: 'Bertahap, mis. Tangerang',
    status: 'coming_soon',
  },
];

const commodities = z.array(Commodity).parse(COMMODITY_SEED);
const markets = z.array(Market).parse(MARKET_SEED);
// The first seed entry; parsing fails at import if it is ever removed or made unavailable.
const DEFAULT_MARKET = Market.refine((item) => item.status === 'available').parse(MARKET_SEED[0]);

export function listCommodities(): readonly Commodity[] {
  return commodities;
}

export function getCommodity(slug: string): Commodity | undefined {
  return commodities.find((item) => item.slug === slug);
}

export function isCommoditySlug(slug: string): slug is CommoditySlug {
  return CommoditySlug.safeParse(slug).success;
}

export function listMarkets(): readonly Market[] {
  return markets;
}

/** The only market with data during the Capstone stage. */
export function defaultMarket(): Market {
  return DEFAULT_MARKET;
}
