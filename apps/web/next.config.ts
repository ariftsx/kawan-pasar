import { fileURLToPath } from 'node:url';
import type { NextConfig } from 'next';
import { buildCsp } from './src/lib/csp';

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
  // Public URLs stay market-free; data pages render under /[market]/… (ADR 0009).
  rewrites() {
    return Promise.resolve({
      beforeFiles: [],
      afterFiles: [{ source: '/pasar', destination: '/PIKJ/pasar' }],
      fallback: [],
    });
  },
  headers() {
    return Promise.resolve([{ source: '/:path*', headers: securityHeaders }]);
  },
};

export default config;
