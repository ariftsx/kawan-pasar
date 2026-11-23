/**
 * Public data URLs and their market-scoped internal routes (ADR 0009). Used by next.config
 * (rewrites) and checked against `proxy.ts` `matcher` by `proxy.test.ts`.
 */
export const DATA_SECTIONS = [
  'beranda',
  'harga',
  'prediksi',
  'edukasi',
  'pasar',
  'analis',
] as const;
export type DataSection = (typeof DATA_SECTIONS)[number];

/** Sections with a second segment and what that segment is. */
export const SECTION_PARAM: Partial<Record<DataSection, 'commodity' | 'slug'>> = {
  harga: 'commodity',
  prediksi: 'commodity',
  edukasi: 'slug',
};

export interface Rewrite {
  source: string;
  destination: string;
}

export function dataRewrites(market: string): Rewrite[] {
  return DATA_SECTIONS.flatMap((section) => {
    const base = { source: `/${section}`, destination: `/${market}/${section}` };
    const param = SECTION_PARAM[section];
    return param === undefined
      ? [base]
      : [base, { source: `/${section}/:${param}`, destination: `/${market}/${section}/:${param}` }];
  });
}

/** Internal path the proxy rewrites refused requests to; no route exists there → static 404. */
export const NOT_FOUND_PATH = '/_kp/tidak-ditemukan';
