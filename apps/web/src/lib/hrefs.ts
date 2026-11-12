import type { CommodityCode } from '@kawan-pasar/catalog';
import type { Route } from 'next';

/*
 * Public URLs with a parameter. They exist as rewrites (`/harga/[commodity]` → `/PIKJ/harga/…`),
 * which typed routes list but do not expand into template strings, hence the single cast here.
 * Parameters are typed (catalog codes, validated slugs), so the URLs are always valid.
 */
const route = (path: string): Route => path as Route;

export const hrefs = {
  price: (code: CommodityCode): Route => route(`/harga/${code}`),
  forecast: (code: CommodityCode): Route => route(`/prediksi/${code}`),
  article: (slug: string): Route => route(`/edukasi/${encodeURIComponent(slug)}`),
};
