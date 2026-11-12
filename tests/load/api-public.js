// k6 load test for the public read API (Fase 1A audit).
// Runs inside the backend network AS the web/BFF container (172.30.0.10, the only trusted proxy),
// and every virtual user sends its own X-Forwarded-For — exactly how real traffic will arrive.
// Usage: see docs/testing/uji-beban.md
import http from 'k6/http';
import { check, sleep } from 'k6';
import { Rate } from 'k6/metrics';

const BASE = __ENV.API_URL || 'http://api:3001';
const TOKEN = __ENV.SERVICE_TOKEN;
const unexpected = new Rate('unexpected_status');

export const options = {
  scenarios: {
    browse: {
      executor: 'constant-vus',
      vus: 200,
      duration: '60s',
      exec: 'browse',
    },
  },
  thresholds: {
    'http_req_duration{scenario:browse}': ['p(95)<100'],
    unexpected_status: ['rate==0'],
    http_req_failed: ['rate==0'],
  },
};

const RANGES = ['30d', '90d', '365d', 'all'];
const COMMODITIES = ['cabai-merah-keriting', 'bawang-merah', 'beras-medium-1'];

export function browse() {
  // One client per VU: 10.1.<vu/250>.<vu%250>
  const ip = `10.1.${Math.floor(__VU / 250)}.${__VU % 250}`;
  const params = { headers: { 'x-service-token': TOKEN, 'x-forwarded-for': ip } };
  const commodity = COMMODITIES[__ITER % COMMODITIES.length];
  const range = RANGES[__ITER % RANGES.length];

  const responses = http.batch([
    ['GET', `${BASE}/v1/markets/PIKJ/prices`, null, params],
    [
      'GET',
      `${BASE}/v1/markets/PIKJ/commodities/${commodity}/history?range=${range}`,
      null,
      params,
    ],
    ['GET', `${BASE}/v1/markets/PIKJ/commodities/${commodity}/forecast`, null, params],
  ]);
  for (const res of responses) {
    const ok = check(res, { 'status 200': (r) => r.status === 200 });
    unexpected.add(!ok);
  }
  // ≈ 3 requests per 1.6 s per client ≈ 112/min: just under the 120/min per-client API limit.
  sleep(1.6);
}
