// Next.js 16 proxy (formerly middleware): per-request CSP nonce plus security headers.
// Next.js reads the nonce from the request CSP header and applies it to its own scripts.
import { NextResponse, type NextRequest } from 'next/server';

import { SECURITY_HEADERS, buildCsp, createNonce } from '@/lib/security/csp';

export function proxy(request: NextRequest): NextResponse {
  const nonce = createNonce();
  const csp = buildCsp({ nonce, isDev: process.env.NODE_ENV === 'development' });

  const requestHeaders = new Headers(request.headers);
  requestHeaders.set('x-nonce', nonce);
  requestHeaders.set('Content-Security-Policy', csp);

  const response = NextResponse.next({ request: { headers: requestHeaders } });
  response.headers.set('Content-Security-Policy', csp);
  for (const [name, value] of Object.entries(SECURITY_HEADERS)) {
    response.headers.set(name, value);
  }
  return response;
}

export const config = {
  matcher: [
    {
      source: '/((?!api|_next/static|_next/image|favicon.ico).*)',
      missing: [
        { type: 'header', key: 'next-router-prefetch' },
        { type: 'header', key: 'purpose', value: 'prefetch' },
      ],
    },
  ],
};
