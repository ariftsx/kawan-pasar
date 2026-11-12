import { MARKETS } from '@kawan-pasar/catalog';
import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

const KNOWN = new Set<string>(MARKETS.map((m) => m.code));

/**
 * Guards market-scoped data routes (ADR 0009). An unknown market segment is refused here, so a
 * flood of random paths cannot create render work or ISR cache entries (the cache lives on a
 * size-limited tmpfs). Static pages and assets never reach this function (see `matcher`).
 */
export function proxy(request: NextRequest): NextResponse {
  const market = request.nextUrl.pathname.split('/')[1] ?? '';
  if (!KNOWN.has(market)) {
    return new NextResponse(null, { status: 404, headers: { 'cache-control': 'no-store' } });
  }
  return NextResponse.next();
}

export const config = {
  // Extend with every new /[market]/… route (Fase 1C).
  matcher: ['/:market/pasar'],
};
