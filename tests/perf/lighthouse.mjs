// Lighthouse budget check (Fase 1D). Runs the default mobile profile (simulated slow 4G, 4x CPU
// slowdown) three times per page against the stack behind Traefik and compares the medians with
// budgets.json. Chromium comes from Playwright (already used by the e2e tests).
//
//   pnpm --filter @kawan-pasar/perf lighthouse            # all pages
//   SITE_URL=http://127.0.0.1:8080 RUNS=1 node lighthouse.mjs /beranda
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from '@playwright/test';
import lighthouse from 'lighthouse';

const here = path.dirname(fileURLToPath(import.meta.url));
const outDir = path.join(here, '..', '..', '.audit', 'lighthouse');
mkdirSync(outDir, { recursive: true });

const SITE = process.env.SITE_URL ?? 'http://127.0.0.1:8080';
const RUNS = Number(process.env.RUNS ?? 3);
const PORT = 9333;
const budgets = JSON.parse(readFileSync(path.join(here, 'budgets.json'), 'utf8'));

const DEFAULT_PAGES = [
  '/',
  '/beranda',
  '/harga',
  '/harga/cabai-merah-keriting',
  '/prediksi',
  '/edukasi/apa-itu-inflasi-pangan',
  '/arif-net',
];
const pages = process.argv.slice(2).length > 0 ? process.argv.slice(2) : DEFAULT_PAGES;

const median = (values) => {
  const sorted = [...values].sort((a, b) => a - b);
  return sorted[Math.floor(sorted.length / 2)];
};

function measure(lhr) {
  const audit = (id) => lhr.audits[id]?.numericValue;
  const requests = lhr.audits['network-requests']?.details?.items ?? [];
  const scriptBytes = requests
    .filter((r) => r.resourceType === 'Script')
    .reduce((sum, r) => sum + (r.transferSize ?? 0), 0);
  return {
    lcpMs: audit('largest-contentful-paint'),
    cls: audit('cumulative-layout-shift'),
    tbtMs: audit('total-blocking-time'),
    scriptKb: scriptBytes / 1024,
    performance: lhr.categories.performance.score,
    accessibility: lhr.categories.accessibility.score,
    lcpElement:
      lhr.audits['largest-contentful-paint-element']?.details?.items?.[0]?.items?.[0]?.node
        ?.snippet,
  };
}

const browser = await chromium.launch({ args: [`--remote-debugging-port=${PORT}`] });
const results = [];
try {
  for (const page of pages) {
    const url = SITE + page;
    // Warm the server-side page cache: the budget is for a page served as visitors get it.
    await fetch(url).then((r) => r.arrayBuffer());
    const runs = [];
    for (let i = 0; i < RUNS; i += 1) {
      const result = await lighthouse(url, {
        port: PORT,
        output: 'json',
        logLevel: 'error',
        onlyCategories: ['performance', 'accessibility'],
      });
      if (result === undefined) throw new Error(`no Lighthouse result for ${url}`);
      if (result.lhr.runtimeError) throw new Error(`${url}: ${result.lhr.runtimeError.message}`);
      runs.push(measure(result.lhr));
      if (i === 0)
        writeFileSync(
          path.join(outDir, `${page.replace(/\W+/g, '_') || 'root'}.json`),
          result.report,
        );
    }
    const m = (key) => median(runs.map((r) => r[key]));
    const row = {
      page,
      lcpMs: Math.round(m('lcpMs')),
      cls: Number(m('cls').toFixed(3)),
      tbtMs: Math.round(m('tbtMs')),
      scriptKb: Number(m('scriptKb').toFixed(1)),
      performance: m('performance'),
      accessibility: m('accessibility'),
      lcpElement: runs[0]?.lcpElement,
    };
    row.failures = [
      row.lcpMs > budgets.lcpMs && `LCP ${row.lcpMs} ms > ${budgets.lcpMs}`,
      row.cls >= budgets.cls && `CLS ${row.cls} >= ${budgets.cls}`,
      row.tbtMs > budgets.tbtMs && `TBT ${row.tbtMs} ms > ${budgets.tbtMs}`,
      row.scriptKb > budgets.scriptKb && `JS ${row.scriptKb} KB > ${budgets.scriptKb}`,
      row.accessibility < budgets.accessibility &&
        `a11y ${row.accessibility} < ${budgets.accessibility}`,
    ].filter(Boolean);
    results.push(row);
    console.log(
      `${row.failures.length === 0 ? 'PASS' : 'FAIL'}  ${page.padEnd(34)} LCP ${String(row.lcpMs).padStart(5)} ms  CLS ${row.cls.toFixed(3)}  TBT ${String(row.tbtMs).padStart(4)} ms  JS ${String(row.scriptKb).padStart(6)} KB  perf ${row.performance}  a11y ${row.accessibility}${row.failures.length ? `  ← ${row.failures.join('; ')}` : ''}`,
    );
  }
} finally {
  await browser.close();
}

writeFileSync(
  path.join(outDir, 'summary.json'),
  `${JSON.stringify({ site: SITE, runs: RUNS, budgets, results }, null, 2)}\n`,
);
const failed = results.filter((r) => r.failures.length > 0);
console.log(
  failed.length === 0
    ? `\nall ${results.length} pages within budget`
    : `\n${failed.length} page(s) over budget`,
);
process.exit(failed.length === 0 ? 0 : 1);
