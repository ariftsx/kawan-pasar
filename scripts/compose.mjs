// Single entry point for docker compose. Always applies BOTH compose files and the env file:
// running compose with a different file set recreates containers without the dev-tools ports.
// Usage: node scripts/compose.mjs [--prod] <compose args...>
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('..', import.meta.url));
// --prod (first argument): the production overlay (Fase 5, ADR 0018) instead of the dev tools.
const args = process.argv.slice(2);
const prod = args[0] === '--prod';
const overlay = prod
  ? 'infra/compose/docker-compose.prod.yml'
  : 'infra/compose/docker-compose.dev-tools.yml';
const base = [
  'compose',
  '-p',
  'kawan-pasar',
  '-f',
  'infra/compose/docker-compose.yml',
  '-f',
  overlay,
  '--env-file',
  '.env',
];

// Arguments are passed without a shell, so Git Bash path conversion cannot rewrite /data/... paths.
const run = spawnSync('docker', [...base, ...(prod ? args.slice(1) : args)], {
  cwd: root,
  stdio: 'inherit',
});
process.exit(run.status ?? 1);
