import { resetTestDatabase } from './test-db.js';

// `pnpm --filter @kawan-pasar/api db:test:reset` — prepares kawanpasar_test for other test suites.
await resetTestDatabase();
process.stdout.write('test database reset\n');
