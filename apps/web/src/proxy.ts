import { COMMODITIES, MARKETS } from '@kawan-pasar/catalog';
import { ArticleSlugSchema } from '@kawan-pasar/contracts';
import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { SESSION_COOKIE } from './lib/auth/cookie';
import { ACCOUNT_HOME, AUTH_PAGES } from './lib/auth/redirect';
import { buildCsp } from './lib/csp';
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
/** Account pages (ADR 0011): rendered per request, never cached, scripts need the nonce. */
const ACCOUNT_PREFIXES = ['/akun', '/peringatan', '/berhenti-ringkasan', ...AUTH_PAGES] as const;
/** Pages for signed-in users only: without a session cookie they go to sign-in first. */
const SIGNED_IN_ONLY = [ACCOUNT_HOME, '/peringatan'] as const;
/** Pages opened from e-mailed links that carry a token: the URL must not leak via Referer. */
const TOKEN_PAGES = new Set<string>([
  '/atur-ulang-sandi',
  '/verifikasi-email',
  '/berhenti-ringkasan',
]);

const isAccountPath = (pathname: string): boolean =>
  ACCOUNT_PREFIXES.some((p) => pathname === p || pathname.startsWith(`${p}/`));

function accountPage(request: NextRequest): NextResponse {
  const { pathname } = request.nextUrl;
  const privateHeaders = (res: NextResponse): NextResponse => {
    res.headers.set('cache-control', 'private, no-store');
    if (TOKEN_PAGES.has(pathname)) res.headers.set('referrer-policy', 'no-referrer');
    return res;
  };
  const signedInOnly = SIGNED_IN_ONLY.some((p) => pathname === p || pathname.startsWith(`${p}/`));
  if (signedInOnly && request.cookies.get(SESSION_COOKIE) === undefined) {
    const to = new URL('/masuk', request.url);
    to.searchParams.set('ke', pathname);
    return privateHeaders(NextResponse.redirect(to, 307));
  }
  // 128 random bits per request. Next.js reads the nonce from the forwarded request CSP header
  // and puts it on every script it emits; the response header replaces the static policy.
  const nonce = Buffer.from(crypto.getRandomValues(new Uint8Array(16))).toString('base64');
  const csp = buildCsp({ dev: process.env.NODE_ENV === 'development', nonce });
  const forwarded = new Headers(request.headers);
  forwarded.set('x-nonce', nonce);
  forwarded.set('content-security-policy', csp);
  const res = NextResponse.next({ request: { headers: forwarded } });
  res.headers.set('content-security-policy', csp);
  return privateHeaders(res);
}

export function proxy(request: NextRequest): NextResponse {
  const { pathname } = request.nextUrl;
  if (isAccountPath(pathname)) return accountPage(request);
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
    // Account pages (ADR 0011): nonce CSP, private, sign-in redirect.
    '/akun/:path*',
    '/peringatan/:path*',
    '/berhenti-ringkasan',
    '/masuk',
    '/daftar',
    '/lupa-sandi',
    '/atur-ulang-sandi',
    '/verifikasi-email',
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
