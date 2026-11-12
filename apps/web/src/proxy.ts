import { COMMODITIES, MARKETS } from '@kawan-pasar/catalog';
import { ArticleSlugSchema } from '@kawan-pasar/contracts';
import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { DATA_SECTIONS, NOT_FOUND_PATH, SECTION_PARAM } from './lib/routes';
import type { DataSection } from './lib/routes';

const MARKET_CODES = new Set<string>(MARKETS.map((m) => m.code));
const COMMODITY_CODES = new Set<string>(COMMODITIES.map((c) => c.code));
const SECTIONS = new Set<string>(DATA_SECTIONS);
/** Market behind the public (market-free) URLs; same as next.config rewrites. */
const DEFAULT_MARKET: string = MARKETS[0].code;

export const ONBOARDED_COOKIE = 'kp_onboarded';

function notFound(request: NextRequest): NextResponse {
  return NextResponse.rewrite(new URL(NOT_FOUND_PATH, request.url), {
    status: 404,
    headers: { 'cache-control': 'no-store' },
  });
}

function validParam(section: DataSection, value: string): boolean {
  const kind = SECTION_PARAM[section];
  if (kind === 'commodity') return COMMODITY_CODES.has(value);
  if (kind === 'slug') return ArticleSlugSchema.safeParse(value).success;
  return false;
}

/**
 * 1. `/`: returning visitors (cookie `kp_onboarded=1`) go straight to /beranda.
 * 2. Market-scoped data routes (ADR 0009): unknown markets, commodities, slugs or extra segments
 *    are refused here, so a flood of random paths creates no render work and no ISR entries.
 *    Static pages and assets never reach this function (see `matcher`).
 */
export function proxy(request: NextRequest): NextResponse {
  const { pathname } = request.nextUrl;
  if (pathname === '/') {
    return request.cookies.get(ONBOARDED_COOKIE)?.value === '1'
      ? NextResponse.redirect(new URL('/beranda', request.url), 307)
      : NextResponse.next();
  }
  // The proxy sees the URL as requested (before rewrites): public `/<section>/…` and the
  // internal `/<market>/<section>/…` form are both checked.
  const segments = pathname.slice(1).split('/');
  const isPublic = SECTIONS.has(segments[0] ?? '');
  const [market = '', section = '', param, ...rest] = isPublic
    ? [DEFAULT_MARKET, ...segments]
    : segments;
  if (!MARKET_CODES.has(market) || !SECTIONS.has(section) || rest.length > 0) {
    return notFound(request);
  }
  if (param !== undefined && !validParam(section as DataSection, param)) {
    return notFound(request);
  }
  return NextResponse.next();
}

export const config = {
  // Literal (read statically by Next). proxy.test.ts checks it covers every data rewrite.
  matcher: [
    '/',
    '/beranda/:path*',
    '/harga/:path*',
    '/prediksi/:path*',
    '/edukasi/:path*',
    '/pasar/:path*',
    '/:market/beranda',
    '/:market/harga/:path*',
    '/:market/prediksi/:path*',
    '/:market/edukasi/:path*',
    '/:market/pasar/:path*',
  ],
};
