// Server helpers shared by pages: the price board for the current data mode and the outlooks.
import 'server-only';

import { listCommodities } from '@kawan-pasar/catalog';

import { publicEnv } from '@/lib/env';
import { getOutlook } from '@/lib/outlook/server';

import { priceBoard, type PriceBoard } from './board';

import type { Outlook } from '@/lib/outlook/schema';

export function currentBoard(): PriceBoard {
  return priceBoard(publicEnv.NEXT_PUBLIC_DATA_MODE);
}

export function isDemoMode(): boolean {
  return publicEnv.NEXT_PUBLIC_DATA_MODE === 'demo';
}

/** Outlooks for the forecastable commodities, keyed by slug. */
export async function forecastOutlooks(): Promise<ReadonlyMap<string, Outlook>> {
  const slugs = listCommodities()
    .filter((item) => item.forecast === 'available')
    .map((item) => item.slug);
  const results = await Promise.all(
    slugs.map(async (slug) => [slug, await getOutlook(slug)] as const),
  );
  return new Map(results);
}
