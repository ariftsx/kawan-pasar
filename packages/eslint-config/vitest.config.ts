import { defineConfig } from 'vitest/config';

// Type-aware linting boots a TypeScript program per run; give it room.
export default defineConfig({ test: { include: ['test/**/*.test.ts'], testTimeout: 60_000 } });
