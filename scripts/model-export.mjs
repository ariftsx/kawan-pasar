// ARIF-Net forecast bundle, end to end (Fase 2B, ADR 0012). Usage: pnpm model:export
//   1. the API CLI exports the price history of the covered commodities to a file
//   2. the one-shot `model-export` container (no database, no network) writes a bundle
//   3. the API CLI verifies and promotes the bundle (it replaces the demo bundle)
import { spawnSync } from 'node:child_process';
import { mkdirSync, rmSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('..', import.meta.url));
const artifacts = path.join(root, 'services', 'model-arifnet', 'artifacts');
const inputDir = path.join(artifacts, '.input');
const stamp = new Date()
  .toISOString()
  .replace(/[-:.TZ]/g, '')
  .slice(0, 14);
const inputName = `prices-${stamp}.csv`;
const inputPath = path.join(inputDir, inputName);
// pnpm runs through a shell on Windows and the repository path has spaces: hand the API CLI
// paths relative to its own directory (apps/api), which have none.
const fromApi = (...parts) =>
  ['..', '..', 'services', 'model-arifnet', 'artifacts', ...parts].join('/');

function run(cmd, args, options = {}) {
  const res = spawnSync(cmd, args, {
    cwd: root,
    encoding: 'utf8',
    stdio: ['ignore', options.capture === true ? 'pipe' : 'inherit', 'inherit'],
    shell: process.platform === 'win32' && cmd === 'pnpm',
  });
  if (res.status !== 0) {
    process.stderr.write(`model-export: step failed: ${cmd} ${args.join(' ')}\n`);
    process.exit(res.status ?? 1);
  }
  return res.stdout ?? '';
}

mkdirSync(inputDir, { recursive: true });
try {
  run('pnpm', ['--filter', '@kawan-pasar/api', 'bundle:prices', fromApi('.input', inputName)]);
  const compose = [path.join(root, 'scripts', 'compose.mjs'), '--profile', 'model'];
  run('node', [...compose, 'build', 'model-export']);
  const out = run(
    'node',
    [
      ...compose,
      'run',
      '--rm',
      'model-export',
      '--prices',
      `/artifacts/.input/${inputName}`,
      '--out',
      '/artifacts',
    ],
    { capture: true },
  );
  const written = out.trim().split('\n').at(-1) ?? '';
  const bundleId = path.posix.basename(written);
  if (!/^arifnet-[a-z0-9._-]+$/.test(bundleId)) {
    process.stderr.write(`model-export: unexpected job output: ${written}\n`);
    process.exit(1);
  }
  process.stdout.write(`bundle written: ${bundleId}\n`);
  run('pnpm', ['--filter', '@kawan-pasar/api', 'bundle:promote', fromApi(bundleId)]);
} finally {
  // The price file was only the job's input.
  rmSync(inputPath, { force: true });
}
