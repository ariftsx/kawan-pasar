import type { CommodityCode, MarketCode } from '@kawan-pasar/catalog';
import { ArticleSlugSchema } from './articles.js';
import { CommodityCodeSchema, MarketCodeSchema } from './common.js';

/**
 * Next.js data-cache tags: the contract between the web server (which tags its fetches) and the
 * API (which asks the web server to revalidate them after data changes). One source for both.
 */
export const cacheTags = {
  markets: 'markets',
  prices: (m: MarketCode) => `prices:${m}`,
  history: (m: MarketCode, c: CommodityCode) => `history:${m}:${c}`,
  forecast: (m: MarketCode) => `forecast:${m}`,
  articles: 'articles',
  article: (slug: string) => `article:${slug}`,
} as const;

declare const tagBrand: unique symbol;
export type CacheTag = string & { readonly [tagBrand]: true };

const MAX_TAG_LENGTH = 256;

/** Whitelist parser for tags arriving over the network (revalidation endpoint). */
export function parseCacheTag(raw: string): CacheTag | null {
  if (raw.length > MAX_TAG_LENGTH) return null;
  const parts = raw.split(':');
  const [kind, a, b] = parts;
  const market = (v: string | undefined): boolean => MarketCodeSchema.safeParse(v).success;
  let ok: boolean;
  switch (kind) {
    case 'markets':
    case 'articles':
      ok = parts.length === 1;
      break;
    case 'prices':
    case 'forecast':
      ok = parts.length === 2 && market(a);
      break;
    case 'history':
      ok = parts.length === 3 && market(a) && CommodityCodeSchema.safeParse(b).success;
      break;
    case 'article':
      ok = parts.length === 2 && ArticleSlugSchema.safeParse(a).success;
      break;
    case undefined:
    default:
      ok = false;
  }
  return ok ? (raw as CacheTag) : null;
}
