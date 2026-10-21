import { fileURLToPath } from 'node:url';

import { defineVitestConfig } from '@kawan-pasar/config/vitest';

// Unit tests cover pure modules (lib/); pages and components are covered by Playwright.
export default defineVitestConfig({
  coverageInclude: ['src/lib/**'],
  alias: { '@': fileURLToPath(new URL('./src', import.meta.url)) },
});
