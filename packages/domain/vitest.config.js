import { defineVitestConfig } from '@kawan-pasar/config/vitest';

// docs 14 §8: cost calculation requires 100% coverage.
export default defineVitestConfig({
  thresholds: { lines: 100, functions: 100, branches: 100, statements: 100 },
});
