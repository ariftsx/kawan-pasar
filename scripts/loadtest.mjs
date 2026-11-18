// Load tests on the CPU-limited stack (Fase 1D, docs/testing/uji-beban.md).
//
//   node scripts/loadtest.mjs browse spike edge api   # scenarios in this order
//   node scripts/loadtest.mjs browse --baseline       # Fase 1C shape: 1 web replica, local cache
//   node scripts/loadtest.mjs browse --vus 100 --hold 30s   # quick smoke
//   … --keep                                          # leave the CPU-limited stack up
//
// For every scenario: start the overlay, empty the caches (cold start), record database
// transactions, API requests and Valkey hits, run k6 (1 vCPU) in the backend network, record again.
// Results: .audit/loadtest/summary-<time>.json (+ the raw k6 summaries). The normal stack (no CPU
// limits) is restored at the end. Secrets are read from .env and never printed.
import { execFileSync, spawn } from 'node:child_process';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('..', import.meta.url));
const out = path.join(root, '.audit', 'loadtest');
const traefikOut = path.join(root, '.audit', 'loadtest-traefik');
mkdirSync(out, { recursive: true });
mkdirSync(path.join(traefikOut, 'dynamic'), { recursive: true });

const env = Object.fromEntries(
  readFileSync(path.join(root, '.env'), 'utf8')
    .split(/\r?\n/)
    .filter((l) => l && !l.startsWith('#') && l.includes('='))
    .map((l) => [l.slice(0, l.indexOf('=')), l.slice(l.indexOf('=') + 1)]),
);

const args = process.argv.slice(2);
const flag = (name) => args.includes(`--${name}`);
const option = (name) => {
  const i = args.indexOf(`--${name}`);
  return i === -1 ? undefined : args[i + 1];
};
const optionValues = new Set(['vus', 'hold'].map(option).filter(Boolean));
const scenarios = args.filter((a) => !a.startsWith('--') && !optionValues.has(a));
const baseline = flag('baseline');

const SCRIPTS = {
  browse: { file: 'web-browse.js', traefik: 'per-client' },
  spike: { file: 'web-spike.js', traefik: 'per-client' },
  // The edge limit is tested with the real Traefik configuration, unchanged.
  edge: { file: 'edge-rate-limit.js', traefik: 'real' },
  api: { file: 'api-public.js', traefik: 'per-client' },
  // Fase 2A: wrong-password flood on sign-in (Argon2) while visitors browse.
  auth: { file: 'auth-flood.js', traefik: 'per-client' },
};
for (const s of scenarios) if (!(s in SCRIPTS)) throw new Error(`unknown scenario ${s}`);
if (scenarios.length === 0)
  throw new Error('usage: node scripts/loadtest.mjs browse|spike|edge|api …');

const K6_IP = '172.30.0.12';
const COMPOSE = [
  'compose',
  '-p',
  'kawan-pasar',
  '-f',
  'infra/compose/docker-compose.yml',
  '-f',
  'infra/compose/docker-compose.dev-tools.yml',
  '-f',
  'infra/compose/docker-compose.loadtest.yml',
];

function docker(argv, extraEnv = {}) {
  return execFileSync('docker', argv, {
    cwd: root,
    encoding: 'utf8',
    env: { ...process.env, ...extraEnv },
    stdio: ['ignore', 'pipe', 'pipe'],
    maxBuffer: 256 * 1024 * 1024,
  });
}

function replaceOnce(text, from, to, file) {
  if (text.split(from).length !== 2)
    throw new Error(`${file}: expected exactly one "${from.trim()}"`);
  return text.replace(from, to);
}

/**
 * Traefik configuration for the run, generated from the real files. 'per-client': each virtual
 * user is its own client for the edge limits (X-Forwarded-For from the k6 container is trusted),
 * with the real limit values. 'real': the files as they are.
 */
function writeTraefikConfig(mode) {
  const src = path.join(root, 'infra', 'traefik');
  // A Windows checkout may have CRLF line endings; the patterns below use LF.
  const read = (...parts) => readFileSync(path.join(src, ...parts), 'utf8').replace(/\r\n/g, '\n');
  let staticCfg = read('traefik.yml');
  let middlewares = read('dynamic', 'middlewares.yml');
  let routes = read('dynamic', 'routes.yml');
  if (mode === 'per-client') {
    staticCfg = replaceOnce(
      staticCfg,
      "    address: ':80'\n",
      `    address: ':80'\n    forwardedHeaders:\n      trustedIPs: ['${K6_IP}']\n`,
      'traefik.yml',
    );
    const perClient = '        sourceCriterion:\n          ipStrategy:\n            depth: 1\n';
    middlewares = replaceOnce(
      middlewares,
      '        period: 1s\n',
      `        period: 1s\n${perClient}`,
      'middlewares.yml',
    );
    middlewares = replaceOnce(
      middlewares,
      '        amount: 100\n',
      `        amount: 100\n${perClient}`,
      'middlewares.yml',
    );
  }
  if (baseline)
    routes = replaceOnce(routes, '          - url: http://web-2:3000\n', '', 'routes.yml');
  writeFileSync(path.join(traefikOut, 'traefik.yml'), staticCfg);
  writeFileSync(path.join(traefikOut, 'dynamic', 'middlewares.yml'), middlewares);
  writeFileSync(path.join(traefikOut, 'dynamic', 'routes.yml'), routes);
}

function writeBaselineOverride() {
  const file = path.join(out, 'baseline.override.yml');
  // Fase 1C shape: one replica with an in-process page cache and the CPU of both replicas.
  writeFileSync(file, "services:\n  web-1:\n    environment:\n      VALKEY_WEB_CACHE_URL: ''\n");
  return file;
}

function stackUp() {
  const files = baseline ? ['-f', writeBaselineOverride()] : [];
  const extra = baseline ? { KP_LOADTEST_WEB1_CPUS: '1.5' } : {};
  docker(
    [...COMPOSE, ...files, '--env-file', '.env', 'up', '-d', '--wait', '--remove-orphans'],
    extra,
  );
  // Windows bind mounts do not deliver file events reliably: restart so Traefik reads the config.
  docker([...COMPOSE, ...files, '--env-file', '.env', 'restart', 'traefik'], extra);
  if (baseline) docker([...COMPOSE, ...files, '--env-file', '.env', 'stop', 'web-2'], extra);
}

const id = (service) => docker(['compose', '-p', 'kawan-pasar', 'ps', '-q', service]).trim();

function valkey(...cmd) {
  return docker(['exec', '-e', 'REDISCLI_AUTH', id('valkey-cache'), 'valkey-cli', ...cmd], {
    REDISCLI_AUTH: env.VALKEY_PASSWORD,
  }).trim();
}

function flushCaches() {
  valkey('-n', '0', 'flushdb'); // API JSON cache and rate-limit counters
  valkey('-n', '1', 'flushdb'); // web page and data cache
}

function snapshot() {
  const xacts = Number(
    docker(
      [
        'exec',
        '-e',
        'PGPASSWORD',
        id('postgres'),
        'psql',
        '-U',
        'postgres',
        '-tAc',
        "select xact_commit + xact_rollback from pg_stat_database where datname = 'kawanpasar'",
      ],
      { PGPASSWORD: env.POSTGRES_SUPERUSER_PASSWORD },
    ).trim(),
  );
  const stats = Object.fromEntries(
    valkey('info', 'stats')
      .split(/\r?\n/)
      .filter((l) => l.includes(':'))
      .map((l) => l.split(':')),
  );
  return {
    time: new Date().toISOString(),
    dbTransactions: xacts,
    valkeyHits: Number(stats.keyspace_hits),
    valkeyMisses: Number(stats.keyspace_misses),
  };
}

/** Requests the API answered between two times (its request log), health checks excluded. */
function apiRequests(since, until) {
  return docker(['logs', '--since', since, '--until', until, id('api')])
    .split(/\r?\n/)
    .filter((l) => l.includes('"res":{"statusCode"') && !l.includes('"url":"/health')).length;
}

function runK6(file) {
  const argv = [
    'run',
    '--rm',
    '--cpus',
    '1',
    '--network',
    'kp-backend',
    '--ip',
    K6_IP,
    '-e',
    'SERVICE_TOKEN',
    ...(option('vus') ? ['-e', `VUS=${option('vus')}`] : []),
    ...(option('hold') ? ['-e', `HOLD=${option('hold')}`] : []),
    '-v',
    `${path.join(root, 'tests', 'load')}:/scripts:ro`,
    '-v',
    `${out}:/out`,
    'grafana/k6:2.3.0',
    'run',
    '--quiet',
    `/scripts/${file}`,
  ];
  return new Promise((resolve) => {
    const child = spawn('docker', argv, {
      cwd: root,
      env: { ...process.env, SERVICE_TOKEN: env.SERVICE_TOKEN },
      stdio: ['ignore', 'pipe', 'inherit'],
    });
    let stdout = '';
    child.stdout.on('data', (d) => {
      stdout += d;
    });
    child.on('close', (code) => {
      const line = stdout
        .trim()
        .split(/\r?\n/)
        .filter((l) => l.startsWith('{'))
        .pop();
      resolve({ exitCode: code, k6: line === undefined ? null : JSON.parse(line) });
    });
  });
}

/**
 * Cold start: one request per page on each replica, sequentially, before measuring. A capacity
 * test measures the steady state; the first-render times are reported separately.
 */
async function warmUp() {
  const pages = [
    '/',
    '/beranda',
    '/harga',
    ...[
      'cabai-merah-keriting',
      'bawang-merah',
      'beras-medium-1',
      'cabai-rawit-hijau',
      'cabai-rawit-merah',
    ].map((c) => `/harga/${c}`),
    '/prediksi',
    ...['cabai-merah-keriting', 'bawang-merah', 'beras-medium-1'].map((c) => `/prediksi/${c}`),
    '/edukasi',
    '/edukasi/apa-itu-inflasi-pangan',
    '/pasar',
    '/arif-net',
  ];
  const times = [];
  for (const page of pages) {
    const started = performance.now();
    const res = await fetch(`http://127.0.0.1:8080${page}`, {
      signal: AbortSignal.timeout(30_000),
    });
    await res.arrayBuffer();
    times.push({ page, status: res.status, ms: Math.round(performance.now() - started) });
  }
  return times;
}

/** A second, polite client on another address (the host) while the greedy client floods. */
async function politeClient(untilDone) {
  const statuses = [];
  while (!untilDone()) {
    try {
      const res = await fetch('http://127.0.0.1:8080/arif-net', {
        signal: AbortSignal.timeout(5000),
      });
      statuses.push(res.status);
      await res.arrayBuffer();
    } catch {
      statuses.push(0);
    }
    await new Promise((r) => setTimeout(r, 250));
  }
  return statuses;
}

const summary = { baseline, startedAt: new Date().toISOString(), runs: [] };
let currentTraefik;
try {
  for (const name of scenarios) {
    const { file, traefik } = SCRIPTS[name];
    if (traefik !== currentTraefik) {
      writeTraefikConfig(traefik);
      console.log(
        `[loadtest] starting the CPU-limited stack (traefik: ${traefik}${baseline ? ', baseline' : ''})`,
      );
      stackUp();
      currentTraefik = traefik;
    }
    flushCaches();
    const warmup = ['api', 'edge'].includes(name) ? [] : await warmUp();
    // A page that failed to warm up leaves part of the run cold: say so in the report.
    const coldFailures = warmup.filter((w) => w.status !== 200);
    if (coldFailures.length > 0) {
      console.warn(`[loadtest] warm-up failed for ${coldFailures.map((w) => w.page).join(', ')}`);
    }
    const before = snapshot();
    console.log(`[loadtest] ${name}: running ${file}`);
    let done = false;
    const polite = name === 'edge' ? politeClient(() => done) : Promise.resolve(undefined);
    const result = await runK6(file);
    done = true;
    const politeStatuses = await polite;
    const after = snapshot();
    const apiCount = apiRequests(before.time, after.time);
    const run = {
      scenario: name,
      exitCode: result.exitCode,
      thresholdsPassed: result.exitCode === 0,
      ...(warmup.length > 0 ? { coldRenderMs: warmup } : {}),
      k6: result.k6,
      apiRequests: apiCount,
      dbTransactions: after.dbTransactions - before.dbTransactions,
      valkeyHits: after.valkeyHits - before.valkeyHits,
      valkeyMisses: after.valkeyMisses - before.valkeyMisses,
      ...(politeStatuses
        ? {
            otherClient: {
              requests: politeStatuses.length,
              ok: politeStatuses.filter((s) => s === 200).length,
            },
          }
        : {}),
    };
    summary.runs.push(run);
    console.log(`[loadtest] ${JSON.stringify(run)}`);
  }
} finally {
  if (flag('keep')) console.log('[loadtest] --keep: the CPU-limited stack stays up');
  else restore();
}

function restore() {
  console.log('[loadtest] restoring the normal stack');
  execFileSync('node', ['scripts/compose.mjs', 'up', '-d', '--wait', '--remove-orphans'], {
    cwd: root,
    stdio: 'inherit',
  });
  execFileSync('node', ['scripts/compose.mjs', 'restart', 'traefik'], {
    cwd: root,
    stdio: 'inherit',
  });
}

const file = path.join(
  out,
  `summary-${summary.startedAt.replace(/[:.]/g, '-')}${baseline ? '-baseline' : ''}.json`,
);
writeFileSync(file, `${JSON.stringify(summary, null, 2)}\n`);
console.log(`[loadtest] written ${path.relative(root, file)}`);
process.exit(summary.runs.every((r) => r.thresholdsPassed) ? 0 : 1);
