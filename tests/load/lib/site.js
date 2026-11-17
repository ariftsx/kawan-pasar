// Shared helpers for the k6 scripts that browse the public site through Traefik (Fase 1D).
import http from 'k6/http';
import { check } from 'k6';

export const BASE = __ENV.SITE_URL || 'http://traefik';

export const HARGA = [
  'cabai-merah-keriting',
  'bawang-merah',
  'beras-medium-1',
  'cabai-rawit-hijau',
  'cabai-rawit-merah',
];
export const PREDIKSI = ['cabai-merah-keriting', 'bawang-merah', 'beras-medium-1'];
export const ARTICLES = ['apa-itu-inflasi-pangan'];

/** One client address per virtual user (10.2.x.y), like distinct visitors behind the edge. */
export function clientIp(vu) {
  return `10.2.${Math.floor(vu / 250)}.${(vu % 250) + 1}`;
}

export function pick(list) {
  return list[Math.floor(Math.random() * list.length)];
}

export function headers(ip) {
  return { 'x-forwarded-for': ip, 'accept-encoding': 'br, gzip', accept: 'text/html' };
}

/** The page sequence of one visit: home → prices → a commodity → forecast → learn. */
export function visitPaths() {
  return [
    '/beranda',
    '/harga',
    `/harga/${pick(HARGA)}`,
    '/prediksi',
    `/prediksi/${pick(PREDIKSI)}`,
    '/edukasi',
    `/edukasi/${pick(ARTICLES)}`,
  ];
}

const SCRIPT_SRC = /<script src="(\/_next\/static\/[^"]+\.js)"/g;

/** JS files a browser would download for this page (static, immutable). */
export function scriptsOf(html) {
  const out = [];
  for (const m of html.matchAll(SCRIPT_SRC)) out.push(m[1]);
  return out;
}

export function getPage(path, ip, extraTags = {}) {
  const res = http.get(`${BASE}${path}`, {
    headers: headers(ip),
    tags: { type: 'page', name: path.split('/').slice(0, 2).join('/') || '/', ...extraTags },
  });
  check(res, {
    'page 200': (r) => r.status === 200,
    'page is complete html': (r) => typeof r.body === 'string' && r.body.includes('</html>'),
  });
  return res;
}

/** Downloads scripts not yet in this VU's "browser cache" (immutable assets are fetched once). */
export function getScripts(html, ip, seen) {
  const todo = scriptsOf(html).filter((src) => !seen.has(src));
  if (todo.length === 0) return;
  const responses = http.batch(
    todo.map((src) => [
      'GET',
      `${BASE}${src}`,
      null,
      { headers: headers(ip), tags: { type: 'asset', name: 'script' } },
    ]),
  );
  responses.forEach((r, i) => {
    check(r, { 'asset 200': (x) => x.status === 200 });
    seen.add(todo[i]);
  });
}

/** Writes the full k6 summary to /out (mounted by scripts/loadtest.mjs) and a short line to stdout. */
export function summary(name, data) {
  const m = data.metrics;
  const v = (metric, key) => (m[metric] && m[metric].values ? m[metric].values[key] : undefined);
  const line = {
    scenario: name,
    requests: v('http_reqs', 'count'),
    rps: v('http_reqs', 'rate'),
    failed: v('http_req_failed', 'rate'),
    p95_page_ms: v('http_req_duration{type:page}', 'p(95)'),
    p95_all_ms: v('http_req_duration', 'p(95)'),
    checks: v('checks', 'rate'),
  };
  return {
    stdout: `${JSON.stringify(line)}\n`,
    [`/out/k6-${name}.json`]: JSON.stringify(data, null, 1),
  };
}
