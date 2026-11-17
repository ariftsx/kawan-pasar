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

const WEB_REPLICAS = ['web-1', 'web-2'];
const SERVICES = [
  'postgres',
  'pgbouncer',
  'valkey-cache',
  'valkey-queue',
  'traefik',
  'api',
  ...WEB_REPLICAS,
];
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

async function checkAsync(name, fn) {
  try {
    results.push([name, (await fn()) === false ? 'FAIL' : 'OK']);
  } catch (e) {
    results.push([name, `FAIL (${redact(e instanceof Error ? e.message : 'error')})`]);
  }
}

const EDGE = 'http://127.0.0.1:8080';
const edge = (path, init = {}) =>
  fetch(EDGE + path, { signal: AbortSignal.timeout(5000), ...init });

await checkAsync('web through traefik: 200 with CSP and security headers', async () => {
  const res = await edge('/');
  const csp = res.headers.get('content-security-policy') ?? '';
  return (
    res.status === 200 &&
    csp.includes("frame-ancestors 'none'") &&
    csp.includes("object-src 'none'") &&
    res.headers.get('x-content-type-options') === 'nosniff' &&
    !res.headers.has('x-powered-by')
  );
});

// Compression per kind of response (Fase 1D): HTML is compressed on every page view, so the edge
// uses cheap gzip; immutable static JS is downloaded once per visitor, so it gets brotli.
await checkAsync('HTML is gzip, static JS is brotli and immutable', async () => {
  const accept = { 'accept-encoding': 'gzip, deflate, br' };
  const page = await edge('/', { headers: accept });
  const html = await page.text();
  const src = /<script src="(\/_next\/static\/[^"]+\.js)"/.exec(html)?.[1];
  if (src === undefined) throw new Error('no script in page');
  const js = await edge(src, { headers: accept });
  return (
    page.headers.get('content-encoding') === 'gzip' &&
    js.headers.get('content-encoding') === 'br' &&
    (js.headers.get('cache-control') ?? '').includes('immutable')
  );
});

// Validation schemas are server-only: a client import of the @kawan-pasar/contracts index once
// shipped every zod schema to the browser (~30 KB compressed on every data page).
await checkAsync('no validation library in the browser bundle of a data page', async () => {
  const html = await (await edge('/beranda')).text();
  const scripts = [...html.matchAll(/<script src="(\/_next\/static\/[^"]+\.js)"/g)].map(
    (m) => m[1],
  );
  if (scripts.length === 0) throw new Error('no script in page');
  for (const src of scripts) {
    if ((await (await edge(src)).text()).includes('ZodError')) throw new Error(`zod in ${src}`);
  }
  return true;
});

await checkAsync('internal revalidation is unreachable from outside', async () => {
  const res = await edge('/api/internal/revalidate', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ tags: ['articles'] }),
  });
  return res.status >= 400 && res.status !== 401;
});

/** Runs a Node.js snippet inside a web replica (backend network, no host ports). */
function inWeb(service, script, secretEnv = {}) {
  const envArgs = Object.keys(secretEnv).flatMap((k) => ['-e', k]);
  return docker(
    ['compose', '-p', 'kawan-pasar', 'exec', '-T', ...envArgs, service, 'node', '-e', script],
    secretEnv,
  ).trim();
}

for (const service of WEB_REPLICAS) {
  check(`api accepts ${service} (trusted proxy) with the service token`, () => {
    const out = inWeb(
      service,
      "fetch('http://api:3001/v1/markets',{headers:{'x-service-token':process.env.SERVICE_TOKEN}}).then(r=>console.log(r.status))",
      { SERVICE_TOKEN: env.SERVICE_TOKEN },
    );
    return out === '200';
  });

  check(`${service} runs as non-root, read-only, with memory and process limits`, () => {
    const id = containerId(service);
    const [user, ro, memory, pids] = docker([
      'inspect',
      '-f',
      '{{.Config.User}} {{.HostConfig.ReadonlyRootfs}} {{.HostConfig.Memory}} {{.HostConfig.PidsLimit}}',
      id,
    ])
      .trim()
      .split(' ');
    return (
      user !== '' &&
      user !== 'root' &&
      user !== '0' &&
      ro === 'true' &&
      Number(memory) > 0 &&
      Number(pids) > 0
    );
  });
}

await checkAsync('traefik balances requests over both web replicas', async () => {
  const since = new Date(Date.now() - 1000).toISOString();
  for (let i = 0; i < 12; i++) await edge('/arif-net');
  const addrs = docker(['logs', '--since', since, containerId('traefik')])
    .split(/\r?\n/)
    .filter((l) => l.startsWith('{') && l.includes('"RouterName":"web@file"'))
    .map((l) => JSON.parse(l).ServiceAddr);
  const seen = new Set(addrs);
  return seen.has('web-1:3000') && seen.has('web-2:3000');
});

// web-2 reads http://127.0.0.1:3000 (itself) after web-1 rendered the page: with no per-process
// cache (cacheMaxMemorySize 0) a HIT can only come from the shared Valkey cache.
const SELF = (path) =>
  `fetch('http://127.0.0.1:3000${path}').then(r=>console.log(r.status+' '+r.headers.get('x-nextjs-cache')))`;

check('shared cache: entries are scoped to the running build (no pages of an older build)', () => {
  const build = docker([
    'exec',
    containerId('web-1'),
    'cat',
    '/app/apps/web/.next/BUILD_ID',
  ]).trim();
  inWeb('web-1', SELF('/pasar'));
  const keys = docker(
    [
      'exec',
      '-e',
      'REDISCLI_AUTH',
      containerId('valkey-cache'),
      'valkey-cli',
      '-n',
      '1',
      '--scan',
      '--pattern',
      'kp:web:v1:entry:*/$/PIKJ/pasar',
    ],
    { REDISCLI_AUTH: env.VALKEY_PASSWORD },
  )
    .split(/\r?\n/)
    .filter(Boolean);
  return build !== '' && keys.some((k) => k.startsWith(`kp:web:v1:entry:${build}:`));
});

check('shared cache: a page rendered by web-1 is a HIT on web-2', () => {
  inWeb('web-1', SELF('/pasar'));
  inWeb('web-1', SELF('/pasar'));
  return inWeb('web-2', SELF('/pasar')) === '200 HIT';
});

check('shared cache: a revalidation received by web-1 makes web-2 serve the page as stale', () => {
  inWeb('web-2', SELF('/edukasi'));
  if (inWeb('web-2', SELF('/edukasi')) !== '200 HIT') throw new Error('/edukasi not cached');
  const status = inWeb(
    'web-2',
    "fetch('http://web-1:3000/api/internal/revalidate',{method:'POST',headers:{'content-type':'application/json','x-revalidate-token':process.env.WEB_REVALIDATE_TOKEN},body:JSON.stringify({tags:['articles']})}).then(r=>console.log(r.status))",
    { WEB_REVALIDATE_TOKEN: env.WEB_REVALIDATE_TOKEN },
  );
  if (status !== '204') throw new Error(`revalidate answered ${status}`);
  return inWeb('web-2', SELF('/edukasi')) === '200 STALE';
});

await checkAsync('ISR: data page is cached after the first request', async () => {
  await edge('/pasar');
  const res = await edge('/pasar');
  return res.status === 200 && res.headers.get('x-nextjs-cache') === 'HIT';
});

const width = Math.max(...results.map(([n]) => n.length));
for (const [name, status] of results) console.log(`${name.padEnd(width)}  ${status}`);
const failed = results.filter(([, s]) => s !== 'OK').length;
console.log(failed === 0 ? '\nall infrastructure checks passed' : `\n${failed} check(s) failed`);
process.exit(failed === 0 ? 0 : 1);
