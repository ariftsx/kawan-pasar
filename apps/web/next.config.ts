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
  // v0.4 renamed the routes and dropped the warung planner; old links land on the closest page.
  redirects() {
    return Promise.resolve([
      { source: '/pantau', destination: '/harga', permanent: true },
      { source: '/outlook/:slug', destination: '/prediksi?komoditas=:slug', permanent: true },
      { source: '/outlook', destination: '/prediksi', permanent: true },
      { source: '/pelajari', destination: '/edukasi', permanent: true },
      { source: '/konteks', destination: '/harga', permanent: true },
      { source: '/rencana', destination: '/', permanent: true },
      { source: '/atur-warung', destination: '/', permanent: true },
    ]);
  },
};

export default config;
