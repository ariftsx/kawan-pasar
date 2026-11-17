import { defineConfig } from 'vitest/config';

// Integration tests talk to the local Valkey from the compose stack (`pnpm infra:up`).
export default defineConfig({
  test: {
    environment: 'node',
    include: ['src/**/*.int.test.ts'],
    setupFiles: ['./test/load-env.ts'],
    fileParallelism: false,
    testTimeout: 15_000,
  },
});
