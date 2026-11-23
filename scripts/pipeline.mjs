// ARIF-Net retraining pipeline (Fase 4A), through the `pipeline` container. Airflow drives the
// same container from Fase 4B on.
//   pnpm pipeline status            prospective-test lock (locked: data up to 2026-09-30 only)
//   pnpm pipeline run [--quick]     collect → preprocess → prices → train → candidate bundle
//   pnpm pipeline import <run-id>   import that run's PIHPS prices into the product (ingest job)
// A run never promotes a model: its bundle is a candidate for the admin audit (Fase 4C).
import { spawnSync } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('..', import.meta.url));
const compose = path.join(root, 'scripts', 'compose.mjs');
const runs = path.join(root, 'data', 'pipeline', 'runs');
const RUN_ID = /^[A-Za-z0-9][A-Za-z0-9._-]{0,63}$/;

function call(args, { capture = false } = {}) {
  const res = spawnSync('node', [compose, ...args], {
    cwd: root,
    encoding: 'utf8',
    stdio: ['ignore', capture ? 'pipe' : 'inherit', 'inherit'],
  });
  if (res.status !== 0) {
    console.error(
      `pipeline: step failed (exit ${String(res.status)}): ${args.slice(0, 4).join(' ')}`,
    );
    process.exit(res.status ?? 1);
  }
  return res.stdout ?? '';
}

const pipeline = (...args) => ['--profile', 'pipeline', 'run', '--rm', 'pipeline', ...args];

function status() {
  const out = call(pipeline('status'), { capture: true });
  return JSON.parse(out.trim().split('\n').at(-1) ?? '{}');
}

const [command, arg] = process.argv.slice(2);
if (command === 'status') {
  console.log(JSON.stringify(status()));
} else if (command === 'run') {
  call(
    pipeline(
      'run',
      '--store',
      '/data/store',
      '--runs',
      '/data/runs',
      ...(arg === '--quick' ? ['--quick'] : []),
    ),
  );
} else if (command === 'import') {
  if (arg === undefined || !RUN_ID.test(arg)) {
    console.error('usage: pnpm pipeline import <run-id>');
    process.exit(2);
  }
  const state = path.join(runs, arg, 'run.json');
  if (!existsSync(state)) {
    console.error(`no such run: ${arg}`);
    process.exit(2);
  }
  const run = JSON.parse(readFileSync(state, 'utf8'));
  if (run.steps?.prices?.status !== 'ok') {
    console.error(`run ${arg} has no price file yet (step "prices" not ok)`);
    process.exit(2);
  }
  // The ceiling comes from the lock as it is NOW, not from when the run was made.
  const lock = status();
  const ceiling = lock.open === true ? 'none' : lock.data_ceiling;
  call([
    '--profile',
    'jobs',
    'run',
    '--rm',
    'ingest',
    'import-pihps',
    '--file',
    `/data/pipeline-runs/${arg}/out/prices_pihps.csv`,
    '--ceiling',
    ceiling,
  ]);
} else {
  console.error('usage: pnpm pipeline status | run [--quick] | import <run-id>');
  process.exit(2);
}
