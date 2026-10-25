import { fileURLToPath } from 'node:url';

import { defineVitestConfig } from '@kawan-pasar/config/vitest';

const src = (path) => fileURLToPath(new URL(`./src/${path}`, import.meta.url));

// Unit tests cover pure modules (lib/); pages and components are covered by Playwright.
export default defineVitestConfig({
  coverageInclude: ['src/lib/**'],
  alias: { '@': src(''), 'server-only': src('lib/testing/server-only.ts') },
});
