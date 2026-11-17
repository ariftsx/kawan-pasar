import { fileURLToPath } from 'node:url';
import type { NextConfig } from 'next';
import { MARKETS } from '@kawan-pasar/catalog';
import { buildCsp } from './src/lib/csp';
import { dataRewrites } from './src/lib/routes';

const dev = process.env.NODE_ENV === 'development';

const securityHeaders = [
  { key: 'Content-Security-Policy', value: buildCsp({ dev }) },
  { key: 'Cross-Origin-Opener-Policy', value: 'same-origin' },
  { key: 'X-Content-Type-Options', value: 'nosniff' },
  { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
];

const config: NextConfig = {
  output: 'standalone',
  // Monorepo: trace workspace packages from the repository root into the standalone output.
  outputFileTracingRoot: fileURLToPath(new URL('../..', import.meta.url)),
  poweredByHeader: false,
  // Compression is done once at the edge (Traefik: brotli/gzip), not by every web replica.
  compress: false,
  reactStrictMode: true,
  typedRoutes: true,
  // The whole UI is inline SVG; there is no raster image to optimise.
  images: { unoptimized: true },
  transpilePackages: ['@kawan-pasar/catalog', '@kawan-pasar/contracts', '@kawan-pasar/tokens'],
  experimental: { sri: { algorithm: 'sha256' } },
  // ISR pages and the data cache live in Valkey, shared by every web replica (ADR 0010). Built to
  // JavaScript first (`pnpm build:cache-handler`): Next.js loads this file as-is at run time.
  cacheHandler: fileURLToPath(
    new URL('./dist/cache-handler/valkey-cache-handler.js', import.meta.url),
  ),
  // No per-process copy: a replica must see another replica's revalidation on its next read.
  cacheMaxMemorySize: 0,
  // Public URLs stay market-free; data pages render under /[market]/… (ADR 0009).
  rewrites() {
    return Promise.resolve({
      beforeFiles: [],
      // Fase 1: one market with data. Market selection arrives with a second market.
      afterFiles: dataRewrites(MARKETS[0].code),
      fallback: [],
    });
  },
  headers() {
    return Promise.resolve([{ source: '/:path*', headers: securityHeaders }]);
  },
};

export default config;
