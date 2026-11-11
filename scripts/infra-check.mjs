// Verifies the local infrastructure contract (docs/plans/2026-11-11-fase-0-fondasi.md, Task 3).
// Usage: node scripts/infra-check.mjs   (reads secrets from .env, never prints them)
import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('..', import.meta.url));
const env = Object.fromEntries(
  readFileSync(new URL('../.env', import.meta.url), 'utf8')
    .split(/\r?\n/)
    .filter((l) => l && !l.startsWith('#') && l.includes('='))
    .map((l) => [l.slice(0, l.indexOf('=')), l.slice(l.indexOf('=') + 1)]),
);

const SERVICES = ['postgres', 'pgbouncer', 'valkey-cache', 'valkey-queue', 'traefik'];
const EXPECTED_HOST_PORTS = new Set(['15432', '16432', '16379', '16380', '8080', '3001']);
const results = [];
const secrets = Object.entries(env)
  .filter(([k, v]) => /PASSWORD|TOKEN|SECRET/.test(k) && v.length > 0)
  .map(([, v]) => v);

/** Error text from child processes echoes the command line, which can contain secrets. */
function redact(text) {
  return secrets.reduce((t, s) => t.split(s).join('***'), text);
}

function check(name, fn) {
  try {
    const ok = fn();
    results.push([name, ok === false ? 'FAIL' : 'OK']);
  } catch (e) {
    results.push([
      name,
      `FAIL (${redact(e instanceof Error ? (e.message.split('\n')[0] ?? '') : 'error')})`,
    ]);
  }
}

/** Secrets are passed as `-e NAME` (value inherited from the child env), never on argv. */
function docker(args, secretEnv = {}) {
  return execFileSync('docker', args, {
    cwd: root,
    encoding: 'utf8',
    env: { ...process.env, ...secretEnv },
    stdio: ['pipe', 'pipe', 'pipe'],
  });
}

function containerId(service) {
  return docker(['compose', '-p', 'kawan-pasar', 'ps', '-q', service]).trim();
}

for (const s of SERVICES) {
  check(`${s} healthy`, () => {
    const id = containerId(s);
    if (!id) throw new Error('not running');
    return docker(['inspect', '-f', '{{.State.Health.Status}}', id]).trim() === 'healthy';
  });
}

function psqlViaPgbouncer(user, password) {
  const id = containerId('postgres');
  return docker(
    [
      'exec',
      '-e',
      'PGPASSWORD',
      id,
      'psql',
      '-h',
      'pgbouncer',
      '-p',
      '6432',
      '-U',
      user,
      '-d',
      'kawanpasar',
      '-tAc',
      'select current_user',
    ],
    { PGPASSWORD: password },
  ).trim();
}

check(
  'app_rw connects through pgbouncer',
  () => psqlViaPgbouncer('app_rw', env.APP_RW_PASSWORD) === 'app_rw',
);
check(
  'ingest_w connects through pgbouncer',
  () => psqlViaPgbouncer('ingest_w', env.INGEST_W_PASSWORD) === 'ingest_w',
);
check('pgbouncer rejects wrong password', () => {
  try {
    psqlViaPgbouncer('app_rw', 'wrong-password');
    return false;
  } catch {
    return true;
  }
});

for (const s of ['valkey-cache', 'valkey-queue']) {
  check(`${s} rejects unauthenticated clients`, () =>
    docker(['exec', containerId(s), 'valkey-cli', 'ping']).includes('NOAUTH'),
  );
  check(
    `${s} accepts the password`,
    () =>
      docker(['exec', '-e', 'REDISCLI_AUTH', containerId(s), 'valkey-cli', 'ping'], {
        REDISCLI_AUTH: env.VALKEY_PASSWORD,
      }).trim() === 'PONG',
  );
}
check('valkey-cache evicts (allkeys-lru), valkey-queue never evicts', () => {
  const policy = (s) =>
    docker(
      [
        'exec',
        '-e',
        'REDISCLI_AUTH',
        containerId(s),
        'valkey-cli',
        'config',
        'get',
        'maxmemory-policy',
      ],
      { REDISCLI_AUTH: env.VALKEY_PASSWORD },
    )
      .trim()
      .split(/\s+/)[1];
  return policy('valkey-cache') === 'allkeys-lru' && policy('valkey-queue') === 'noeviction';
});

check('only expected host ports, all bound to 127.0.0.1', () => {
  const bindings = docker(['compose', '-p', 'kawan-pasar', 'ps', '--format', 'json'])
    .split(/\r?\n/)
    .filter((l) => l.trim().startsWith('{'))
    .flatMap((l) => JSON.parse(l).Publishers ?? [])
    .filter((p) => p.PublishedPort !== 0)
    .map((p) => ({ url: p.URL, port: String(p.PublishedPort) }));
  if (bindings.length === 0) throw new Error('no published ports found');
  const published = new Set(bindings.map((b) => b.port));
  const missing = [...EXPECTED_HOST_PORTS].filter((p) => !published.has(p));
  // A missing dev port means compose ran without the dev-tools overlay (use scripts/compose.mjs).
  if (missing.length > 0)
    throw new Error(`expected host ports not published: ${missing.join(', ')}`);
  return bindings.every((b) => b.url === '127.0.0.1' && EXPECTED_HOST_PORTS.has(b.port));
});

try {
  const res = await fetch('http://127.0.0.1:8080/', { signal: AbortSignal.timeout(3000) });
  // No routes exist yet in Fase 0, so Traefik answers 404 — but it must carry the security headers.
  const ok =
    res.headers.get('x-content-type-options') === 'nosniff' && !res.headers.has('x-powered-by');
  results.push(['traefik answers on 127.0.0.1:8080 with security headers', ok ? 'OK' : 'FAIL']);
} catch (e) {
  results.push([
    'traefik answers on 127.0.0.1:8080 with security headers',
    `FAIL (${redact(e instanceof Error ? e.message : 'error')})`,
  ]);
}

const width = Math.max(...results.map(([n]) => n.length));
for (const [name, status] of results) console.log(`${name.padEnd(width)}  ${status}`);
const failed = results.filter(([, s]) => s !== 'OK').length;
console.log(failed === 0 ? '\nall infrastructure checks passed' : `\n${failed} check(s) failed`);
process.exit(failed === 0 ? 0 : 1);
