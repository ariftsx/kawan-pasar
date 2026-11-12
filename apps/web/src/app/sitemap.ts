import { COMMODITIES } from '@kawan-pasar/catalog';
import type { MetadataRoute } from 'next';
import { SITE_URL } from '@/lib/seo';

/** Built from the catalog only, so it never needs the API at build time. */
export default function sitemap(): MetadataRoute.Sitemap {
  const paths = [
    '/',
    '/beranda',
    '/harga',
    '/prediksi',
    '/edukasi',
    '/arif-net',
    '/arif-net/keterbatasan',
    '/pasar',
    ...COMMODITIES.map((c) => `/harga/${c.code}`),
    ...COMMODITIES.filter((c) => c.modelCoverage === 'covered').map((c) => `/prediksi/${c.code}`),
  ];
  return paths.map((p) => ({ url: new URL(p, SITE_URL).href, changeFrequency: 'daily' }));
}
