import { existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

// Loads the repo-level .env (created by `pnpm env:init`) for tests that talk to local infra.
const envFile = fileURLToPath(new URL('../../../../.env', import.meta.url));
if (existsSync(envFile)) process.loadEnvFile(envFile);

/**
 * Tests use logical database 15 of the same Valkey instances. Sharing database 0 with the running
 * development API let test data (e.g. a test forecast bundle cached in a price summary) be served
 * by the dev stack. The database index only separates keys; no extra container is needed.
 */
const TEST_VALKEY_DB = '15';
for (const name of ['VALKEY_CACHE_URL', 'VALKEY_QUEUE_URL', 'VALKEY_SESSION_URL']) {
  const value = process.env[name];
  if (value === undefined || value === '') continue;
  const url = new URL(value);
  url.pathname = `/${TEST_VALKEY_DB}`;
  process.env[name] = url.href;
}
