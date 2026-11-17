import { existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

// Loads the repo-level .env (created by `pnpm env:init`) for tests that talk to local infra.
const envFile = fileURLToPath(new URL('../../../.env', import.meta.url));
if (existsSync(envFile)) process.loadEnvFile(envFile);

/**
 * The web cache tests use logical database 14 of the cache Valkey: the running stack uses 1 (web)
 * and 0 (API), the API integration tests 15. Each test file may empty database 14.
 */
const value = process.env['VALKEY_CACHE_URL'];
if (value !== undefined && value !== '') {
  const url = new URL(value);
  url.pathname = '/14';
  process.env['TEST_VALKEY_WEB_CACHE_URL'] = url.href;
}
