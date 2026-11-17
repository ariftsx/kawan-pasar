// Capacity test (Fase 1D): 500 visitors browse the public site for 5 minutes through Traefik.
// Run with scripts/loadtest.mjs (CPU-limited stack; each virtual user is its own client address).
import { sleep } from 'k6';
import { clientIp, getPage, getScripts, summary, visitPaths } from './lib/site.js';

export const options = {
  scenarios: {
    browse: {
      executor: 'ramping-vus',
      startVUs: 0,
      stages: [
        { duration: '30s', target: Number(__ENV.VUS || 500) },
        { duration: __ENV.HOLD || '5m', target: Number(__ENV.VUS || 500) },
        { duration: '10s', target: 0 },
      ],
      gracefulRampDown: '10s',
    },
  },
  // Design §11: error rate < 0.5 %, p95 < 500 ms for pages.
  thresholds: {
    http_req_failed: ['rate<0.005'],
    'http_req_duration{type:page}': ['p(95)<500'],
    checks: ['rate>0.99'],
  },
  summaryTrendStats: ['avg', 'med', 'p(90)', 'p(95)', 'p(99)', 'max'],
};

const seen = new Set();

export default function () {
  const ip = clientIp(__VU);
  for (const path of visitPaths()) {
    const res = getPage(path, ip);
    if (res.status === 200 && typeof res.body === 'string') getScripts(res.body, ip, seen);
    // Reading time between pages.
    sleep(1 + Math.random() * 2);
  }
}

export function handleSummary(data) {
  return summary('web-browse', data);
}
