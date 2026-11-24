import { describe, expect, it } from 'vitest';
import {
  AirflowClient,
  AirflowRequestError,
  AirflowUnavailableError,
} from '../../src/modules/pipeline/airflow-client.js';

const TARGET = { url: 'http://airflow-api-server:8080', password: 'p'.repeat(40) };

/** A JWT whose payload expires at `exp` (seconds). */
const jwt = (exp: number): string =>
  `h.${Buffer.from(JSON.stringify({ exp })).toString('base64url')}.s`;

interface Seen {
  method: string;
  path: string;
  auth: string | null;
  body: unknown;
}

function fakeAirflow(routes: Record<string, (seen: Seen) => Response>): {
  fetchFn: typeof fetch;
  seen: Seen[];
} {
  const seen: Seen[] = [];
  const fetchFn = ((input: string | URL | Request, init?: RequestInit) => {
    const url = new URL(input instanceof Request ? input.url : input.toString());
    const entry: Seen = {
      method: init?.method ?? 'GET',
      path: url.pathname + url.search,
      auth: new Headers(init?.headers).get('authorization'),
      body: typeof init?.body === 'string' ? JSON.parse(init.body) : null,
    };
    seen.push(entry);
    const route = routes[`${entry.method} ${url.pathname}`];
    return Promise.resolve(
      route === undefined ? new Response('{}', { status: 404 }) : route(entry),
    );
  }) as typeof fetch;
  return { fetchFn, seen };
}

const json = (body: unknown, status = 200): Response =>
  new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } });

describe('AirflowClient (Fase 4C)', () => {
  it('logs in as the service account once and reuses the token until it nearly expires', async () => {
    let now = 1_000_000_000_000;
    const { fetchFn, seen } = fakeAirflow({
      'POST /auth/token': () => json({ access_token: jwt(now / 1000 + 600) }),
      'GET /api/v2/dags/latih_ulang': () => json({ dag_id: 'latih_ulang', is_paused: false }),
    });
    const client = new AirflowClient(TARGET, fetchFn, () => now);
    await client.dag('latih_ulang');
    await client.dag('latih_ulang');
    expect(seen.filter((s) => s.path === '/auth/token')).toHaveLength(1);
    expect(seen[0]?.body).toEqual({ username: 'kawanpasar-api', password: TARGET.password });
    expect(seen[1]?.auth).toMatch(/^Bearer h\./);
    now += 560_000; // within the 60 s margin of expiry
    await client.dag('latih_ulang');
    expect(seen.filter((s) => s.path === '/auth/token')).toHaveLength(2);
  });

  it('retries once with a new token after a 401', async () => {
    let calls = 0;
    const { fetchFn, seen } = fakeAirflow({
      'POST /auth/token': () => json({ access_token: jwt(9_999_999_999) }),
      'GET /api/v2/dags/harga_harian': () =>
        ++calls === 1 ? json({}, 401) : json({ dag_id: 'harga_harian', is_paused: true }),
    });
    const dag = await new AirflowClient(TARGET, fetchFn).dag('harga_harian');
    expect(dag.is_paused).toBe(true);
    expect(seen.filter((s) => s.path === '/auth/token')).toHaveLength(2);
  });

  it('triggers with no logical date and the given conf, and pauses with an update mask', async () => {
    const { fetchFn, seen } = fakeAirflow({
      'POST /auth/token': () => json({ access_token: jwt(9_999_999_999) }),
      'POST /api/v2/dags/latih_ulang/dagRuns': () =>
        json({ dag_run_id: 'manual__x', state: 'queued', run_type: 'manual' }),
      'PATCH /api/v2/dags/latih_ulang': () => json({ dag_id: 'latih_ulang', is_paused: true }),
    });
    const client = new AirflowClient(TARGET, fetchFn);
    expect(await client.trigger('latih_ulang', { quick: false })).toBe('manual__x');
    await client.setPaused('latih_ulang', true);
    expect(seen[1]?.body).toEqual({ logical_date: null, conf: { quick: false } });
    expect(seen[2]).toMatchObject({
      method: 'PATCH',
      path: '/api/v2/dags/latih_ulang?update_mask=is_paused',
      body: { is_paused: true },
    });
  });

  it('reads a task result, and null when the task has none', async () => {
    const { fetchFn } = fakeAirflow({
      'POST /auth/token': () => json({ access_token: jwt(9_999_999_999) }),
      'GET /api/v2/dags/status_kunci/dagRuns/r%2F1/taskInstances/status/xcomEntries/return_value':
        () => json({ value: { open: false } }),
    });
    const client = new AirflowClient(TARGET, fetchFn);
    expect(await client.taskResult('status_kunci', 'r/1', 'status')).toEqual({ open: false });
    expect(await client.taskResult('status_kunci', 'r/2', 'status')).toBeNull();
  });

  it('reports Airflow as unavailable when unconfigured, down, or failing', async () => {
    await expect(new AirflowClient(null).dag('latih_ulang')).rejects.toBeInstanceOf(
      AirflowUnavailableError,
    );
    const down = (() => Promise.reject(new TypeError('fetch failed'))) as typeof fetch;
    await expect(new AirflowClient(TARGET, down).dag('latih_ulang')).rejects.toBeInstanceOf(
      AirflowUnavailableError,
    );
    const { fetchFn } = fakeAirflow({ 'POST /auth/token': () => json({}, 503) });
    await expect(new AirflowClient(TARGET, fetchFn).dag('latih_ulang')).rejects.toBeInstanceOf(
      AirflowUnavailableError,
    );
  });

  it('turns a refused request into a request error without leaking credentials', async () => {
    const { fetchFn } = fakeAirflow({ 'POST /auth/token': () => json({}, 403) });
    const error = await new AirflowClient(TARGET, fetchFn)
      .dag('latih_ulang')
      .catch((e: unknown) => e);
    expect(error).toBeInstanceOf(AirflowRequestError);
    expect(String(error)).not.toContain(TARGET.password);
  });
});
