// Runs every quality gate of a phase in order and prints a pass/fail table.
// Usage: pnpm audit:all        Full logs per step: .audit/<step>.log (git-ignored)
import { spawnSync } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync, statSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('..', import.meta.url));
const logDir = path.join(root, '.audit');
mkdirSync(logDir, { recursive: true });

const ingest = path.join(root, 'services', 'ingest');

/** @type {Array<{ name: string, cmd: string, cwd?: string } | { name: string, fn: () => string[] }>} */
const steps = [
  { name: 'format', cmd: 'pnpm format:check' },
  { name: 'lint', cmd: 'pnpm lint' },
  { name: 'typecheck', cmd: 'pnpm typecheck' },
  { name: 'unit-tests', cmd: 'pnpm test' },
  // Builds the web app without any API or secrets (data pages must not need them at build time).
  { name: 'web-build', cmd: 'pnpm --filter @kawan-pasar/web build' },
  // Containers must run the code under audit, not an image from an earlier build.
  {
    name: 'stack-rebuild',
    // The worker runs the API image: list it too, or it keeps running the previous build.
    cmd: 'node scripts/compose.mjs up -d --wait --build --remove-orphans api worker web-1 web-2',
  },
  { name: 'infra', cmd: 'pnpm infra:check' },
  { name: 'integration-tests', cmd: 'pnpm test:int' },
  // End-user simulation through Traefik: 6 widths, axe, reduced motion, JS budget.
  { name: 'e2e-smoke', cmd: 'pnpm --filter @kawan-pasar/e2e e2e' },
  // Design budgets on the Lighthouse mobile profile (slow 4G, 4x CPU): LCP, CLS, TBT, JS, a11y.
  { name: 'lighthouse', cmd: 'pnpm --filter @kawan-pasar/perf lighthouse' },
  { name: 'test-db-reset', cmd: 'pnpm --filter @kawan-pasar/api db:test:reset' },
  {
    name: 'ingest-tests',
    cmd: 'uv run pytest -q --cov=kp_ingest --cov-fail-under=90',
    cwd: ingest,
  },
  { name: 'ingest-mypy', cmd: 'uv run mypy --strict src tests', cwd: ingest },
  { name: 'ingest-ruff', cmd: 'uv run ruff check && uv run ruff format --check', cwd: ingest },
  { name: 'dependency-audit', cmd: 'pnpm audit --audit-level=moderate' },
  { name: 'no-any-scan', fn: scanForAny },
  { name: 'no-ai-attribution-scan', fn: scanForAttribution },
];

function listFiles() {
  const out = spawnSync('git', ['ls-files', '-co', '--exclude-standard'], {
    cwd: root,
    encoding: 'utf8',
  });
  if (out.status !== 0) throw new Error('git ls-files failed');
  // `ls-files -c` still lists tracked files deleted in the working tree (e.g. a moved module).
  return out.stdout
    .split('\n')
    .filter(Boolean)
    .filter((f) => existsSync(path.join(root, f)));
}

const TEXT = /\.(ts|tsx|js|mjs|cjs|py|md|json|ya?ml|sql|toml|css|html|txt|ini|sh)$|Dockerfile$/;

function readText(file) {
  const full = path.join(root, file);
  if (statSync(full).size > 2_000_000) return '';
  return readFileSync(full, 'utf8');
}

function scanForAny() {
  const banned = /(:\s*any\b|<any>|\bas any\b|@ts-ignore|@ts-expect-error|@ts-nocheck)/;
  return listFiles()
    .filter((f) => /^(apps|packages)\/.*\.tsx?$/.test(f))
    .filter((f) => !f.startsWith('packages/eslint-config/test/fixtures/'))
    .filter((f) => banned.test(readText(f)))
    .map((f) => `banned type escape in ${f}`);
}

// The owner's rule: the repository never credits an AI assistant. CONTRIBUTING.md states the rule
// and this script defines the patterns, so both are excluded. The FigCraft prototype folder is the
// owner's own design tooling and is reported separately in the phase audit, not scanned here.
const ATTRIBUTION = [
  /co-authored-by:/i,
  /generated (with|by) .{0,20}(claude|chatgpt|copilot|gemini|ai\b)/i,
  /\bclaude\b/i,
  /\banthropic\b/i,
  /\bchatgpt\b/i,
  /\bcopilot\b/i,
];
const ATTRIBUTION_EXCLUDE = ['CONTRIBUTING.md', 'scripts/audit.mjs'];

function scanForAttribution() {
  return listFiles()
    .filter((f) => TEXT.test(f))
    .filter((f) => !ATTRIBUTION_EXCLUDE.includes(f) && !f.startsWith('figcraft-Kawan_Pasar/'))
    .flatMap((f) => {
      const text = readText(f);
      return ATTRIBUTION.filter((re) => re.test(text)).map((re) => `${f} matches ${re}`);
    });
}

const results = [];
for (const step of steps) {
  const started = Date.now();
  let ok;
  let log;
  if ('fn' in step) {
    const findings = step.fn();
    ok = findings.length === 0;
    log = findings.join('\n') || 'no findings';
  } else {
    const run = spawnSync(step.cmd, {
      cwd: step.cwd ?? root,
      shell: true,
      encoding: 'utf8',
      env: process.env,
      maxBuffer: 64 * 1024 * 1024,
      // A hung gate must fail the audit, not stall it.
      timeout: 15 * 60 * 1000,
    });
    ok = run.status === 0;
    log = `$ ${step.cmd}\n${run.stdout}\n${run.stderr}`;
  }
  writeFileSync(path.join(logDir, `${step.name}.log`), log);
  const seconds = ((Date.now() - started) / 1000).toFixed(1);
  results.push({ name: step.name, ok, seconds });
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${step.name.padEnd(24)} ${seconds}s`);
}

const failed = results.filter((r) => !r.ok);
console.log(
  failed.length === 0
    ? `\nall ${results.length} gates passed`
    : `\n${failed.length} gate(s) failed: ${failed.map((r) => r.name).join(', ')} — see .audit/<gate>.log`,
);
process.exit(failed.length === 0 ? 0 : 1);
