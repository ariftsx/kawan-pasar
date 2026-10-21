import type { NextConfig } from 'next';

// docs 12 §11. Security headers and CSP are set per request in src/proxy.ts.
const config: NextConfig = {
  output: 'standalone',
  cacheComponents: true,
  partialPrefetching: true,
  poweredByHeader: false,
  productionBrowserSourceMaps: false,
  reactStrictMode: true,
  typedRoutes: true,
  images: { formats: ['image/avif', 'image/webp'], remotePatterns: [] },
};

export default config;
