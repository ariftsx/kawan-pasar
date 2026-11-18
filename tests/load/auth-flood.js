// Sign-in flood (Fase 2A): wrong passwords against the login endpoint while visitors browse.
// Every sign-in costs one Argon2id hash (19 MiB, 2 passes), so this is the most expensive request
// an attacker can send. Run with scripts/loadtest.mjs auth (CPU-limited stack).
import http from 'k6/http';
import { sleep } from 'k6';
import { Counter, Rate } from 'k6/metrics';
import { clientIp, getPage, summary, visitPaths } from './lib/site.js';

const API = __ENV.API_URL || 'http://api:3001';
const TOKEN = __ENV.SERVICE_TOKEN;
const serverErrors = new Rate('auth_server_errors');
const limited = new Counter('auth_429');
const refused = new Counter('auth_401');

export const options = {
  scenarios: {
    // 50 attackers behind ONE address: the per-IP limit (10/min) must cut them off.
    flood_one_ip: {
      executor: 'constant-vus',
      vus: 50,
      duration: '60s',
      exec: 'floodOneIp',
    },
    // 50 attackers, each its own address and its own target: only the per-account lockout and
    // the per-IP limit slow them down; every attempt that passes costs one Argon2 hash.
    flood_spread: {
      executor: 'constant-vus',
      vus: 50,
      duration: '60s',
      exec: 'floodSpread',
    },
    // Ordinary visitors at the same time: public pages must stay normal.
    visitors: {
      executor: 'constant-vus',
      vus: 20,
      duration: '60s',
      exec: 'visit',
    },
  },
  thresholds: {
    auth_server_errors: ['rate==0'],
    'http_req_duration{scenario:visitors,type:page}': ['p(95)<500'],
  },
  summaryTrendStats: ['avg', 'med', 'p(90)', 'p(95)', 'p(99)', 'max'],
};

function attempt(ip, email) {
  const res = http.post(
    `${API}/v1/auth/login`,
    JSON.stringify({ email, password: 'tebakan kata sandi yang salah' }),
    {
      headers: {
        'content-type': 'application/json',
        'x-service-token': TOKEN,
        'x-forwarded-for': ip,
      },
      tags: { type: 'auth' },
    },
  );
  serverErrors.add(res.status >= 500 || res.status === 0);
  if (res.status === 429) limited.add(1);
  if (res.status === 401) refused.add(1);
}

export function floodOneIp() {
  attempt('10.66.0.1', `korban${String(__VU % 5)}@contoh.id`);
  sleep(0.2);
}

export function floodSpread() {
  attempt(
    `10.77.${String(Math.floor(__VU / 250))}.${String((__VU % 250) + 1)}`,
    `orang${String(__VU)}-${String(__ITER)}@contoh.id`,
  );
  sleep(0.2);
}

export function visit() {
  const ip = clientIp(__VU);
  for (const path of visitPaths()) {
    getPage(path, ip);
    sleep(1 + Math.random() * 2);
  }
}

export function handleSummary(data) {
  return summary('auth-flood', data);
}
