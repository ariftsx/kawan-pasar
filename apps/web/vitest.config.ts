import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vitest/config';

export default defineConfig({
  oxc: { jsx: { runtime: 'automatic' } },
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
      // `server-only` throws outside a React Server environment; tests run the server code directly.
      'server-only': fileURLToPath(new URL('./test/server-only-stub.ts', import.meta.url)),
    },
  },
  test: {
    environment: 'happy-dom',
    include: ['src/**/*.test.{ts,tsx}'],
    exclude: ['src/**/*.int.test.ts'],
    setupFiles: ['./vitest.setup.ts'],
  },
});
