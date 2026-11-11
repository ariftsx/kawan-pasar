import { existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

// Loads the repo-level .env (created by `pnpm env:init`) for tests that talk to local infra.
const envFile = fileURLToPath(new URL('../../../../.env', import.meta.url));
if (existsSync(envFile)) process.loadEnvFile(envFile);
