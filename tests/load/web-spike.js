// Spike test (Fase 1D): 0 → 800 visitors in 10 s, held for 60 s, then a small steady load that
// must be served normally again (the stack recovers on its own, no restart).
import { sleep } from 'k6';
import { Counter, Rate } from 'k6/metrics';
import { clientIp, getPage, summary, visitPaths } from './lib/site.js';

const serverErrors = new Rate('server_errors');
const edgeLimited = new Counter('edge_429');

export const options = {
  scenarios: {
    spike: {
      executor: 'ramping-vus',
      startVUs: 0,
      stages: [
        { duration: '10s', target: 800 },
        { duration: '60s', target: 800 },
        { duration: '10s', target: 0 },
      ],
      gracefulRampDown: '5s',
      exec: 'visit',
    },
    after: {
      executor: 'constant-vus',
      vus: 30,
      startTime: '85s',
      duration: '30s',
      exec: 'visit',
    },
  },
  thresholds: {
    // 429 from the edge is an accepted answer to a flood; a 5xx is not.
    server_errors: ['rate==0'],
    'http_req_duration{scenario:after,type:page}': ['p(95)<500'],
  },
  summaryTrendStats: ['avg', 'med', 'p(90)', 'p(95)', 'p(99)', 'max'],
};

export function visit() {
  const ip = clientIp(__VU);
  for (const path of visitPaths()) {
    const res = getPage(path, ip);
    serverErrors.add(res.status >= 500 || res.status === 0);
    if (res.status === 429) edgeLimited.add(1);
    sleep(0.5 + Math.random());
  }
}

export function handleSummary(data) {
  return summary('web-spike', data);
}
