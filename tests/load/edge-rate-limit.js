// Edge rate limit (Fase 1D), against the REAL Traefik configuration: one greedy client sends
// 200 requests per second for 10 s. Traefik must answer most of them with 429 instead of passing
// them on; scripts/loadtest.mjs meanwhile checks that another client is still served.
import http from 'k6/http';
import { check } from 'k6';
import { Counter } from 'k6/metrics';
import { summary } from './lib/site.js';

const BASE = __ENV.SITE_URL || 'http://traefik';
const ok = new Counter('greedy_200');
const limited = new Counter('greedy_429');
const other = new Counter('greedy_other');

export const options = {
  scenarios: {
    greedy: {
      executor: 'constant-arrival-rate',
      rate: 200,
      timeUnit: '1s',
      duration: '10s',
      preAllocatedVUs: 50,
      maxVUs: 200,
    },
  },
  thresholds: {
    // Traefik: average 50/s, burst 100 → at most ~600 of 2000 pass in 10 s.
    greedy_429: ['count>1000'],
    greedy_other: ['count==0'],
  },
};

export default function () {
  const res = http.get(`${BASE}/arif-net`, { tags: { type: 'page' } });
  if (res.status === 200) ok.add(1);
  else if (res.status === 429) limited.add(1);
  else other.add(1);
  check(res, { 'answered 200 or 429': (r) => r.status === 200 || r.status === 429 });
}

export function handleSummary(data) {
  return summary('edge-rate-limit', data);
}
