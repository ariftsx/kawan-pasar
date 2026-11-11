// Single entry point for docker compose. Always applies BOTH compose files and the env file:
// running compose with a different file set recreates containers without the dev-tools ports.
// Usage: node scripts/compose.mjs <compose args...>
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('..', import.meta.url));
const base = [
  'compose',
  '-p',
  'kawan-pasar',
  '-f',
  'infra/compose/docker-compose.yml',
  '-f',
  'infra/compose/docker-compose.dev-tools.yml',
  '--env-file',
  '.env',
];

// Arguments are passed without a shell, so Git Bash path conversion cannot rewrite /data/... paths.
const run = spawnSync('docker', [...base, ...process.argv.slice(2)], {
  cwd: root,
  stdio: 'inherit',
});
process.exit(run.status ?? 1);
