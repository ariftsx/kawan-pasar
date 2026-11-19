import type { NestFastifyApplication } from '@nestjs/platform-fastify';
import { Queue } from 'bullmq';
import { Redis } from 'ioredis';
import type pg from 'pg';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { createDb } from '../../src/database/client.js';
import { ALERTS_QUEUE } from '../../src/modules/alerts/alerts.queue.js';
import { AuthTokenService } from '../../src/modules/auth/auth-token.service.js';
import { MAIL_QUEUE } from '../../src/modules/mail/mail.queue.js';
import type { MailJob } from '../../src/modules/mail/mail.queue.js';
import { poolFor, resetTestDatabase } from '../helpers/test-db.js';
import { serviceToken, startApp, testEnv } from '../helpers/test-app.js';

const PASSWORD = 'pasar kramat jati pagi hari';
let app: NestFastifyApplication;
let owner: pg.Pool;
let mailQueue: Queue<MailJob>;
let alertsQueue: Queue;
let queueConnection: Redis;
let sessions: Redis;

interface Reply {
  status: number;
  json: () => Record<string, unknown>;
}

async function call(
  method: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE',
  url: string,
  o: { body?: unknown; session?: string; csrf?: string } = {},
): Promise<Reply> {
  const res = await app.inject({
    method,
    url,
    headers: {
      'x-service-token': serviceToken(),
      'x-forwarded-for': '10.1.2.3',
      ...(o.session === undefined ? {} : { 'x-session-token': o.session }),
      ...(o.csrf === undefined ? {} : { 'x-csrf-token': o.csrf }),
    },
    ...(o.body === undefined ? {} : { payload: o.body as object }),
  });
  return { status: res.statusCode, json: () => res.json<Record<string, unknown>>() };
}

/** A verified account, signed in: its session token and CSRF secret. */
async function account(email: string): Promise<{ session: string; csrf: string; id: string }> {
  await call('POST', '/v1/auth/register', {
    body: { email, password: PASSWORD, acceptPrivacy: true },
  });
  const jobs = await mailQueue.getJobs(['waiting', 'delayed', 'completed', 'failed', 'active']);
  const verify = jobs
    .map((j) => j.data)
    .find((d) => d.template === 'verify_email' && d.to === email);
  await call('POST', '/v1/auth/verify-email', { body: { token: verify?.token } });
  const login = (
    await call('POST', '/v1/auth/login', { body: { email, password: PASSWORD } })
  ).json();
  const id = (await owner.query<{ id: string }>('SELECT id FROM users WHERE email = $1', [email]))
    .rows[0]?.id;
  return { session: String(login['token']), csrf: String(login['csrf']), id: id ?? '' };
}

beforeAll(async () => {
  await resetTestDatabase();
  owner = poolFor('owner');
  const env = testEnv({ TRUSTED_PROXY_IPS: '127.0.0.1' });
  app = await startApp({ env });
  queueConnection = new Redis(env.VALKEY_QUEUE_URL, { maxRetriesPerRequest: null });
  mailQueue = new Queue<MailJob>(MAIL_QUEUE, { connection: queueConnection });
  alertsQueue = new Queue(ALERTS_QUEUE, { connection: queueConnection });
  sessions = new Redis(env.VALKEY_SESSION_URL);
});

beforeEach(async () => {
  await owner.query('DELETE FROM users');
  await mailQueue.obliterate({ force: true });
  await alertsQueue.obliterate({ force: true });
  await sessions.flushdb();
  const cache = new Redis(testEnv().VALKEY_CACHE_URL);
  await cache.flushdb();
  cache.disconnect();
});

afterAll(async () => {
  await mailQueue.close();
  await alertsQueue.close();
  queueConnection.disconnect();
  sessions.disconnect();
  await app.close();
  await owner.end();
});

describe('alert settings (session + CSRF)', () => {
  it('starts with the default switches and no watches', async () => {
    const a = await account('sari@contoh.id');
    expect((await call('GET', '/v1/alerts', a)).json()).toEqual({
      preferences: {
        inApp: true,
        weekly: false,
        unusualMove: true,
        forecastRise: true,
        priceThreshold: true,
      },
      watches: [],
      emailVerified: true,
    });
  });

  it('needs a session, and CSRF for every change', async () => {
    const a = await account('sari@contoh.id');
    expect((await call('GET', '/v1/alerts')).status).toBe(401);
    const body = { commodity: 'bawang-merah' };
    expect((await call('POST', '/v1/alerts/watches', { session: a.session, body })).status).toBe(
      403,
    );
    expect((await call('POST', '/v1/alerts/watches', { ...a, body })).status).toBe(204);
  });

  it('saves switches and watches with an own limit; a commodity is watched once', async () => {
    const a = await account('sari@contoh.id');
    const prefs = {
      inApp: true,
      weekly: true,
      unusualMove: false,
      forecastRise: true,
      priceThreshold: true,
    };
    expect((await call('PUT', '/v1/alerts/preferences', { ...a, body: prefs })).status).toBe(204);
    const watch = {
      commodity: 'bawang-merah',
      threshold: { thresholdIdr: 39_000, direction: 'above' },
    };
    expect((await call('POST', '/v1/alerts/watches', { ...a, body: watch })).status).toBe(204);
    const again = await call('POST', '/v1/alerts/watches', { ...a, body: watch });
    expect(again.status).toBe(409);
    expect(again.json()).toMatchObject({ error: { code: 'conflict', fields: ['commodity'] } });
    const view = (await call('GET', '/v1/alerts', a)).json();
    expect(view['preferences']).toEqual(prefs);
    expect(view['watches']).toEqual([
      {
        id: expect.any(Number) as unknown,
        commodity: { code: 'bawang-merah', name: 'Bawang merah' },
        threshold: { thresholdIdr: 39_000, direction: 'above' },
      },
    ]);
  });

  it("updates and removes only the owner's own watches (no IDOR)", async () => {
    const a = await account('sari@contoh.id');
    const b = await account('budi@contoh.id');
    await call('POST', '/v1/alerts/watches', { ...a, body: { commodity: 'bawang-merah' } });
    const [w] = (await call('GET', '/v1/alerts', a)).json()['watches'] as { id: number }[];
    const url = `/v1/alerts/watches/${String(w?.id)}`;
    const limit = { threshold: { thresholdIdr: 50_000, direction: 'below' } };
    expect((await call('PATCH', url, { ...b, body: limit })).status).toBe(404);
    expect((await call('DELETE', url, b)).status).toBe(404);
    expect((await call('PATCH', url, { ...a, body: limit })).status).toBe(204);
    expect((await call('PATCH', url, { ...a, body: { threshold: null } })).status).toBe(204);
    expect((await call('DELETE', url, a)).status).toBe(204);
    expect((await call('DELETE', url, a)).status).toBe(404);
  });

  it('refuses unknown commodities, bad limits and more than 20 watches', async () => {
    const a = await account('sari@contoh.id');
    for (const body of [
      { commodity: 'gula-pasir' },
      { commodity: 'bawang-merah', threshold: { thresholdIdr: -1, direction: 'above' } },
      { commodity: 'bawang-merah', threshold: { thresholdIdr: 1000 } },
    ]) {
      expect(
        (await call('POST', '/v1/alerts/watches', { ...a, body })).status,
        JSON.stringify(body),
      ).toBe(400);
    }
    // 20 rows directly (the catalog has only five commodities): the 21st is refused.
    await owner.query(
      `INSERT INTO alert_watches (user_id, market_id, commodity_id)
       SELECT $1, m.id, c.id FROM markets m CROSS JOIN commodities c LIMIT 20`,
      [a.id],
    );
    const n = await owner.query<{ n: number }>('SELECT count(*)::int AS n FROM alert_watches');
    expect(n.rows[0]?.n).toBe(20); // 4 markets × 5 commodities
    const res = await call('POST', '/v1/alerts/watches', {
      ...a,
      body: { commodity: 'bawang-merah' },
    });
    expect(res.status).toBe(409);
    expect(res.json()).toMatchObject({ error: { code: 'conflict', fields: ['limit'] } });
  });
});

describe('notifications', () => {
  async function seed(userId: string, n: number, kind = 'price_threshold'): Promise<void> {
    await owner.query(
      `INSERT INTO notifications (user_id, kind, data_date, title, body, link)
       SELECT $1, $3::notification_kind, DATE '2026-01-01' + g, 'Kabar ' || g, 'Isi ' || g, '/harga/bawang-merah'
       FROM generate_series(1, $2::int) g`,
      [userId, n, kind],
    );
  }

  it('lists newest first in pages of 20 with a cursor, and counts unread', async () => {
    const a = await account('sari@contoh.id');
    await seed(a.id, 25);
    const first = (await call('GET', '/v1/notifications', a)).json();
    expect((first['items'] as unknown[]).length).toBe(20);
    expect(first['unread']).toBe(25);
    expect((first['items'] as { title: string }[])[0]?.title).toBe('Kabar 25');
    const next = (await call('GET', `/v1/notifications?before=${String(first['next'])}`, a)).json();
    expect((next['items'] as unknown[]).length).toBe(5);
    expect(next['next']).toBeNull();
  });

  it('tabs: unread and weekly summaries', async () => {
    const a = await account('sari@contoh.id');
    await seed(a.id, 2);
    await seed(a.id, 1, 'weekly');
    const weekly = (await call('GET', '/v1/notifications?tab=weekly', a)).json();
    expect((weekly['items'] as { kind: string }[]).map((i) => i.kind)).toEqual(['weekly']);
    expect((await call('GET', '/v1/notifications?tab=bogus', a)).status).toBe(400);
  });

  it("marks own news read (ids or all), never someone else's", async () => {
    const a = await account('sari@contoh.id');
    const b = await account('budi@contoh.id');
    await seed(a.id, 3);
    await seed(b.id, 1);
    const items = (await call('GET', '/v1/notifications', a)).json()['items'] as { id: number }[];
    const bItem = (
      (await call('GET', '/v1/notifications', b)).json()['items'] as { id: number }[]
    )[0];
    const mark = await call('POST', '/v1/notifications/read', {
      ...a,
      body: { ids: [items[0]?.id, bItem?.id] },
    });
    expect(mark.json()).toEqual({ marked: 1 });
    expect((await call('GET', '/v1/notifications/unread-count', b)).json()).toEqual({ unread: 1 });
    expect(
      (await call('POST', '/v1/notifications/read', { ...a, body: { all: true } })).json(),
    ).toEqual({
      marked: 2,
    });
    expect((await call('GET', '/v1/notifications/unread-count', a)).json()).toEqual({ unread: 0 });
    expect((await call('GET', '/v1/notifications?tab=unread', a)).json()['items']).toEqual([]);
  });
});

describe('weekly summary unsubscribe link', () => {
  it('switches the summary off once, with no session needed', async () => {
    const a = await account('sari@contoh.id');
    await owner.query('INSERT INTO alert_preferences (user_id, weekly) VALUES ($1, true)', [a.id]);
    const token = await new AuthTokenService(createDb(poolFor('app')), {
      now: () => new Date(),
    }).issue(a.id, 'weekly_unsubscribe');
    expect((await call('POST', '/v1/alerts/weekly/unsubscribe', { body: { token } })).status).toBe(
      204,
    );
    expect(
      ((await call('GET', '/v1/alerts', a)).json()['preferences'] as { weekly: boolean }).weekly,
    ).toBe(false);
    const again = await call('POST', '/v1/alerts/weekly/unsubscribe', { body: { token } });
    expect(again.status).toBe(400);
    expect(again.json()).toMatchObject({ error: { code: 'invalid_token' } });
  });
});

describe('data changes queue an evaluation', () => {
  it('prices and forecasts queue an evaluation, collapsed into one; articles do not', async () => {
    const send = (scope: string): Promise<Reply> =>
      call('POST', '/internal/cache/invalidate', { body: { scope } });
    expect((await send('articles')).status).toBe(200);
    expect(await alertsQueue.count()).toBe(0);
    await send('prices');
    await send('forecasts');
    const jobs = await alertsQueue.getJobs(['waiting', 'delayed']);
    // Two imports in a row: one evaluation (deduplicated while waiting).
    expect(jobs.map((j) => j.name)).toEqual(['evaluate']);
    expect(jobs.every((j) => JSON.stringify(j.data) === '{}')).toBe(true);
  });
});
