import { defineConfig } from 'vitest/config';

/**
 * Shared Vitest defaults (docs 14 §8). Packages raise `thresholds` where the standard demands it,
 * e.g. `packages/domain` requires 100% for cost calculation.
 *
 * @param {{
 *   thresholds?: { lines?: number, functions?: number, branches?: number, statements?: number },
 *   coverageInclude?: string[],
 *   alias?: Record<string, string>,
 * }} [options]
 */
export function defineVitestConfig({
  thresholds = { lines: 90, functions: 90, branches: 90, statements: 90 },
  coverageInclude = ['src/**'],
  alias = {},
} = {}) {
  return defineConfig({
    resolve: { alias },
    test: {
      include: ['src/**/*.test.ts', 'src/**/*.test.tsx'],
      environment: 'node',
      restoreMocks: true,
      coverage: {
        provider: 'v8',
        include: coverageInclude,
        exclude: ['src/**/*.test.*', 'src/**/*.fixture.ts', 'src/**/*.json', 'src/**/index.ts'],
        reporter: ['text', 'lcov'],
        thresholds,
      },
    },
  });
}
