// k6 check that one aggressive client is cut off with 429 while another client is unaffected.
import http from 'k6/http';
import { check } from 'k6';

const BASE = __ENV.API_URL || 'http://api:3001';
const TOKEN = __ENV.SERVICE_TOKEN;

export const options = { vus: 1, iterations: 1 };

export default function () {
  const greedy = { headers: { 'x-service-token': TOKEN, 'x-forwarded-for': '10.250.0.1' } };
  const polite = { headers: { 'x-service-token': TOKEN, 'x-forwarded-for': '10.250.0.2' } };
  const statuses = [];
  for (let i = 0; i < 150; i += 1) {
    statuses.push(http.get(`${BASE}/v1/markets/PIKJ/prices`, greedy).status);
  }
  const ok = statuses.filter((s) => s === 200).length;
  const limited = statuses.filter((s) => s === 429).length;
  check(null, {
    'greedy client gets at most 120 successes per minute': () => ok <= 120,
    'greedy client is rate limited': () => limited >= 30,
    'other clients are unaffected': () =>
      http.get(`${BASE}/v1/markets/PIKJ/prices`, polite).status === 200,
  });
  console.log(`greedy client: ${ok} × 200, ${limited} × 429`);
}
