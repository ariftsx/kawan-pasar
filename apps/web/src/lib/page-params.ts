import 'server-only';
import { COMMODITIES } from '@kawan-pasar/catalog';
import type { Commodity, MarketCode } from '@kawan-pasar/catalog';
import { MarketCodeSchema } from '@kawan-pasar/contracts';
import { notFound } from 'next/navigation';

/** Route params are validated again on the page (proxy.ts is the first check). */
export async function marketFrom(params: Promise<{ market: string }>): Promise<MarketCode> {
  const parsed = MarketCodeSchema.safeParse((await params).market);
  if (!parsed.success) notFound();
  return parsed.data;
}

export function commodityFrom(code: string): Commodity {
  const found = COMMODITIES.find((c) => c.code === code);
  if (found === undefined) notFound();
  return found;
}

/** Commodity featured on the home page: the first covered one that has price data. */
export const FEATURED_COMMODITY = 'cabai-merah-keriting';
