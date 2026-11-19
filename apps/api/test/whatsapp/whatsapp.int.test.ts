import { Writable } from 'node:stream';
import type { NestFastifyApplication } from '@nestjs/platform-fastify';
import { Queue } from 'bullmq';
import { Redis } from 'ioredis';
import type pg from 'pg';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { createDb } from '../../src/database/client.js';
import { PhoneCipher } from '../../src/modules/auth/phone-cipher.js';
import { UsersRepository } from '../../src/modules/auth/users.repository.js';
import { MAIL_QUEUE } from '../../src/modules/mail/mail.queue.js';
import type { MailJob } from '../../src/modules/mail/mail.queue.js';
import { WHATSAPP_QUEUE } from '../../src/modules/whatsapp/whatsapp.queue.js';
import { WhatsAppRepository } from '../../src/modules/whatsapp/whatsapp.repository.js';
import type { WhatsAppJob } from '../../src/modules/whatsapp/whatsapp.queue.js';
import { MESSAGES_PER_DAY, deliver } from '../../src/modules/whatsapp/whatsapp.worker.js';
import { poolFor, resetTestDatabase } from '../helpers/test-db.js';
import { serviceToken, startApp, testEnv } from '../helpers/test-app.js';

const PASSWORD = 'pasar kramat jati pagi hari';
const PHONE = '+6281234567890';
let app: NestFastifyApplication;
let owner: pg.Pool;
let appPool: pg.Pool;
let connection: Redis;
let mailQueue: Queue<MailJob>;
let waQueue: Queue<WhatsAppJob>;
let sessions: Redis;
const logLines: string[] = [];

interface Reply {
  status: number;
  json: () => Record<string, unknown>;
}

async function call(
  method: 'GET' | 'POST' | 'PUT' | 'DELETE',
  url: string,
  o: { body?: unknown; session?: string; csrf?: string } = {},
): Promise<Reply> {
  const res = await app.inject({
    method,
    url,
    headers: {
      'x-service-token': serviceToken(),
      'x-forwarded-for': '10.9.8.7',
      ...(o.session === undefined ? {} : { 'x-session-token': o.session }),
      ...(o.csrf === undefined ? {} : { 'x-csrf-token': o.csrf }),
    },
    ...(o.body === undefined ? {} : { payload: o.body as object }),
  });
  return { status: res.statusCode, json: () => res.json<Record<string, unknown>>() };
}

async function account(email: string, phone: string | null = PHONE) {
  await call('POST', '/v1/auth/register', {
    body: { email, password: PASSWORD, acceptPrivacy: true, ...(phone === null ? {} : { phone }) },
  });
  const jobs = await mailQueue.getJobs(['waiting', 'delayed', 'completed', 'failed', 'active']);
  const verify = jobs
    .map((j) => j.data)
    .find((d) => d.template === 'verify_email' && d.to === email);
  await call('POST', '/v1/auth/verify-email', { body: { token: verify?.token } });
  const login = (
    await call('POST', '/v1/auth/login', { body: { email, password: PASSWORD } })
  ).json();
  const id =
    (await owner.query<{ id: string }>('SELECT id FROM users WHERE email = $1', [email])).rows[0]
      ?.id ?? '';
  return { session: String(login['token']), csrf: String(login['csrf']), id };
}

/** The code the API queued for this user (what the phone would receive). */
async function queuedCode(userId: string): Promise<string> {
  const jobs = await waQueue.getJobs(['waiting', 'delayed']);
  const job = jobs
    .map((j) => j.data)
    .filter(
      (d): d is Extract<WhatsAppJob, { kind: 'code' }> => d.kind === 'code' && d.userId === userId,
    )
    .at(-1);
  return job?.code ?? '';
}

async function connect(a: { session: string; csrf: string; id: string }): Promise<void> {
  expect((await call('POST', '/v1/whatsapp/code', a)).status).toBe(204);
  const code = await queuedCode(a.id);
  expect((await call('POST', '/v1/whatsapp/verify', { ...a, body: { code } })).status).toBe(204);
}

beforeAll(async () => {
  await resetTestDatabase();
  owner = poolFor('owner');
  appPool = poolFor('app');
  const env = testEnv({ TRUSTED_PROXY_IPS: '127.0.0.1', LOG_LEVEL: 'info' });
  app = await startApp({
    env,
    logDestination: new Writable({
      write(chunk: Buffer, _enc, done) {
        logLines.push(chunk.toString('utf8'));
        done();
      },
    }),
  });
  connection = new Redis(env.VALKEY_QUEUE_URL, { maxRetriesPerRequest: null });
  mailQueue = new Queue<MailJob>(MAIL_QUEUE, { connection });
  waQueue = new Queue<WhatsAppJob>(WHATSAPP_QUEUE, { connection });
  sessions = new Redis(env.VALKEY_SESSION_URL);
});

beforeEach(async () => {
  await owner.query('DELETE FROM users');
  await owner.query('DELETE FROM whatsapp_messages');
  await mailQueue.obliterate({ force: true });
  await waQueue.obliterate({ force: true });
  await sessions.flushdb();
  const cache = new Redis(testEnv().VALKEY_CACHE_URL);
  await cache.flushdb();
  cache.disconnect();
});

afterAll(async () => {
  await mailQueue.close();
  await waQueue.close();
  connection.disconnect();
  sessions.disconnect();
  await app.close();
  await appPool.end();
  await owner.end();
});

describe('connecting WhatsApp (session + CSRF)', () => {
  it('needs a number on the account; shows it masked', async () => {
    const none = await account('tanpa@contoh.id', null);
    expect((await call('GET', '/v1/whatsapp', none)).json()).toEqual({
      status: 'none',
      phone: null,
      canSendCode: false,
    });
    const r = await call('POST', '/v1/whatsapp/code', none);
    expect(r.status).toBe(409);
    expect(r.json()).toMatchObject({ error: { code: 'conflict', fields: ['phone'] } });
    const a = await account('sari@contoh.id');
    expect((await call('GET', '/v1/whatsapp', a)).json()).toEqual({
      status: 'none',
      phone: '+62 812 •••• 7890',
      canSendCode: true,
    });
  });

  it('verifies with the six-digit code; the channel stores only the number HMAC', async () => {
    const a = await account('sari@contoh.id');
    expect((await call('POST', '/v1/whatsapp/code', { session: a.session })).status).toBe(403);
    await connect(a);
    expect((await call('GET', '/v1/whatsapp', a)).json()).toMatchObject({ status: 'verified' });
    const row = await owner.query('SELECT * FROM whatsapp_channels WHERE user_id = $1', [a.id]);
    expect(Object.keys(row.rows[0] as object)).not.toContain('phone');
    expect(JSON.stringify(row.rows[0])).not.toContain('81234567890');
    const ev = await owner.query(
      "SELECT count(*)::int AS n FROM auth_events WHERE type = 'wa_verify'",
    );
    expect(ev.rows[0]).toEqual({ n: 1 });
  });

  it('wrong codes count; after five the code is spent; an expired code is refused', async () => {
    const a = await account('sari@contoh.id');
    await call('POST', '/v1/whatsapp/code', a);
    const right = await queuedCode(a.id);
    const wrong = right === '000000' ? '111111' : '000000';
    for (let i = 0; i < 4; i += 1) {
      const r = await call('POST', '/v1/whatsapp/verify', { ...a, body: { code: wrong } });
      expect(r.json()).toMatchObject({ error: { code: 'invalid_token', fields: ['code'] } });
    }
    const fifth = await call('POST', '/v1/whatsapp/verify', { ...a, body: { code: wrong } });
    expect(fifth.json()).toMatchObject({ error: { fields: ['expired'] } });
    const late = await call('POST', '/v1/whatsapp/verify', { ...a, body: { code: right } });
    expect(late.json()).toMatchObject({ error: { fields: ['expired'] } });

    await call('POST', '/v1/whatsapp/code', a);
    const fresh = await queuedCode(a.id);
    await owner.query("UPDATE whatsapp_channels SET code_expires_at = now() - interval '1 second'");
    const expired = await call('POST', '/v1/whatsapp/verify', { ...a, body: { code: fresh } });
    expect(expired.json()).toMatchObject({ error: { fields: ['expired'] } });
  });

  it('limits codes to 3 an hour per account', async () => {
    const a = await account('sari@contoh.id');
    for (let i = 0; i < 3; i += 1)
      expect((await call('POST', '/v1/whatsapp/code', a)).status).toBe(204);
    const r = await call('POST', '/v1/whatsapp/code', a);
    expect(r.status).toBe(429);
    expect((await call('GET', '/v1/whatsapp', a)).json()).toMatchObject({ canSendCode: false });
  });

  it("one account's code cannot verify another's channel (no IDOR)", async () => {
    const a = await account('sari@contoh.id');
    const b = await account('budi@contoh.id', '+6285799991234');
    await call('POST', '/v1/whatsapp/code', a);
    await call('POST', '/v1/whatsapp/code', b);
    const r = await call('POST', '/v1/whatsapp/verify', {
      ...b,
      body: { code: await queuedCode(a.id) },
    });
    expect(r.status).toBe(400);
  });

  it('changing the number on the account disconnects WhatsApp', async () => {
    const a = await account('sari@contoh.id');
    await connect(a);
    await call('PUT', '/v1/me/phone', { ...a, body: { phone: '085799991234' } });
    expect((await call('GET', '/v1/whatsapp', a)).json()).toMatchObject({
      status: 'none',
      phone: '+62 857 •••• 1234',
    });
  });
});

describe('inbound messages (mock webhook)', () => {
  const inbound = (from: string, text: string): Promise<Reply> =>
    call('POST', '/internal/whatsapp/inbound', { body: { from, text } });

  it('STOP stops the channel, records it and queues a confirmation; reconnecting needs a new code', async () => {
    const a = await account('sari@contoh.id');
    await connect(a);
    await waQueue.obliterate({ force: true });
    expect((await inbound('0812-3456-7890', ' stop ')).json()).toEqual({ ok: true });
    expect((await call('GET', '/v1/whatsapp', a)).json()).toMatchObject({
      status: 'stopped',
      canSendCode: true,
    });
    const jobs = (await waQueue.getJobs(['waiting'])).map((j) => j.data);
    expect(jobs).toEqual([{ kind: 'reply', userId: a.id, reply: 'stopped' }]);
    await connect(a);
    expect((await call('GET', '/v1/whatsapp', a)).json()).toMatchObject({ status: 'verified' });
  });

  it('answers the same for unknown numbers and other texts, and never logs the number', async () => {
    const a = await account('sari@contoh.id');
    await connect(a);
    await waQueue.obliterate({ force: true });
    expect((await inbound('+6289999999999', 'STOP')).json()).toEqual({ ok: true });
    expect((await inbound('bukan nomor', 'STOP')).json()).toEqual({ ok: true });
    expect((await inbound(PHONE, 'halo')).json()).toEqual({ ok: true });
    expect((await call('GET', '/v1/whatsapp', a)).json()).toMatchObject({ status: 'verified' });
    expect((await waQueue.getJobs(['waiting'])).map((j) => j.data)).toEqual([
      { kind: 'reply', userId: a.id, reply: 'help' },
    ]);
    const logs = logLines.join('');
    for (const form of ['81234567890', '89999999999']) expect(logs).not.toContain(form);
  });
});

describe('delivery (worker side)', () => {
  const sent: { to: string; text: string }[] = [];
  const sender = {
    send: (to: string, text: string) => {
      sent.push({ to, text });
      return Promise.resolve();
    },
  };
  const deps = () => {
    const db = createDb(appPool);
    const phones = new PhoneCipher(testEnv().PHONE_ENC_KEY);
    return {
      db,
      users: new UsersRepository(db, testEnv().AUTH_SECRET, phones),
      phones,
      sender,
      siteUrl: 'http://127.0.0.1:8080',
      now: () => new Date(),
    };
  };
  async function news(userId: string, n: number): Promise<number[]> {
    const r = await owner.query<{ id: string }>(
      `INSERT INTO notifications (user_id, kind, data_date, title, body, link)
       SELECT $1, 'price_threshold', DATE '2026-01-01' + g, 'Kabar ' || g, 'Isi ' || g, '/harga/bawang-merah'
       FROM generate_series(1, $2::int) g RETURNING id`,
      [userId, n],
    );
    return r.rows.map((x) => Number(x.id));
  }

  beforeEach(() => {
    sent.length = 0;
  });

  it('sends the code to the number while pending', async () => {
    const a = await account('sari@contoh.id');
    await call('POST', '/v1/whatsapp/code', a);
    const code = await queuedCode(a.id);
    expect(await deliver({ kind: 'code', userId: a.id, code }, deps())).toBe('sent');
    expect(sent).toEqual([{ to: PHONE, text: expect.stringContaining(code) as unknown }]);
  });

  it('combines news into one message, marks them sent, and sends nothing twice', async () => {
    const a = await account('sari@contoh.id');
    await connect(a);
    const ids = await news(a.id, 2);
    expect(await deliver({ kind: 'alerts', userId: a.id, notificationIds: ids }, deps())).toBe(
      'sent',
    );
    expect(sent).toHaveLength(1);
    expect(sent[0]?.text).toMatch(/Kabar 1[\s\S]*Kabar 2[\s\S]*Balas STOP/);
    const marked = await owner.query(
      'SELECT count(*)::int AS n FROM notifications WHERE sent_whatsapp_at IS NOT NULL',
    );
    expect(marked.rows[0]).toEqual({ n: 2 });
    expect(await deliver({ kind: 'alerts', userId: a.id, notificationIds: ids }, deps())).toBe(
      'nothing_new',
    );
  });

  it(`stops at ${String(MESSAGES_PER_DAY)} messages a day; never to a stopped, switched-off or other user's channel`, async () => {
    const a = await account('sari@contoh.id');
    await connect(a);
    for (let i = 0; i < MESSAGES_PER_DAY; i += 1) {
      const [id] = await news(a.id, 1);
      await owner.query('UPDATE notifications SET data_date = data_date + $2::int WHERE id = $1', [
        id,
        100 + i,
      ]);
      expect(
        await deliver({ kind: 'alerts', userId: a.id, notificationIds: [id ?? 0] }, deps()),
      ).toBe('sent');
    }
    const [extra] = await news(a.id, 1);
    await owner.query("UPDATE notifications SET data_date = DATE '2027-06-01' WHERE id = $1", [
      extra,
    ]);
    expect(
      await deliver({ kind: 'alerts', userId: a.id, notificationIds: [extra ?? 0] }, deps()),
    ).toBe('daily_cap');

    const b = await account('budi@contoh.id', '+6285799991234');
    await connect(b);
    // Someone else's news ids do nothing for b.
    expect(
      await deliver({ kind: 'alerts', userId: b.id, notificationIds: [extra ?? 0] }, deps()),
    ).toBe('nothing_new');
    await owner.query('INSERT INTO alert_preferences (user_id, whatsapp) VALUES ($1, false)', [
      b.id,
    ]);
    const [bNews] = await news(b.id, 1);
    expect(
      await deliver({ kind: 'alerts', userId: b.id, notificationIds: [bNews ?? 0] }, deps()),
    ).toBe('not_connected');
    await call('POST', '/internal/whatsapp/inbound', {
      body: { from: '+6285799991234', text: 'STOP' },
    });
    await owner.query('UPDATE alert_preferences SET whatsapp = true WHERE user_id = $1', [b.id]);
    expect(
      await deliver({ kind: 'alerts', userId: b.id, notificationIds: [bNews ?? 0] }, deps()),
    ).toBe('not_connected');
  });
});

describe('limits hold under parallel requests (review 2C)', () => {
  it('at most five guesses are checked, even when sent at once', async () => {
    const a = await account('sari@contoh.id');
    await call('POST', '/v1/whatsapp/code', a);
    const right = await queuedCode(a.id);
    const wrong = Array.from({ length: 12 }, (_, i) =>
      String((Number(right) + i + 1) % 1_000_000).padStart(6, '0'),
    );
    const answers = await Promise.all(
      wrong.map(async (code) => {
        const r = await call('POST', '/v1/whatsapp/verify', { ...a, body: { code } });
        return (r.json() as { error: { fields: string[] } }).error.fields[0];
      }),
    );
    // Attempts 1-4 answer 'wrong code'; the fifth spends the code; the other seven are never
    // compared. Without an atomic reservation all twelve would be compared.
    expect(answers.filter((f) => f === 'code')).toHaveLength(4);
    expect(answers.filter((f) => f === 'expired')).toHaveLength(8);
    const late = await call('POST', '/v1/whatsapp/verify', { ...a, body: { code: right } });
    expect(late.json()).toMatchObject({ error: { fields: ['expired'] } });
  });

  it('a burst of code requests sends at most three codes in an hour', async () => {
    const a = await account('sari@contoh.id');
    const statuses = await Promise.all(
      Array.from({ length: 8 }, async () => (await call('POST', '/v1/whatsapp/code', a)).status),
    );
    expect(statuses.filter((s) => s === 204)).toHaveLength(3);
    expect((await waQueue.getJobs(['waiting'])).filter((j) => j.data.kind === 'code')).toHaveLength(
      3,
    );
  });
});

describe('attempt reservation (review 2C, Important 1)', () => {
  it('twelve parallel reservations get exactly five attempts', async () => {
    const a = await account('sari@contoh.id');
    await call('POST', '/v1/whatsapp/code', a);
    const repo = new WhatsAppRepository(createDb(appPool));
    const results = await Promise.all(
      Array.from({ length: 12 }, () => repo.reserveAttempt(a.id, new Date())),
    );
    const granted = results.filter((r) => r !== null);
    expect(granted).toHaveLength(5);
    expect(granted.map((r) => r.attempts).sort()).toEqual([1, 2, 3, 4, 5]);
  });
});

describe('delivery is all-or-nothing and capped under concurrency (review 2C, Important 6)', () => {
  const deps = (send: (to: string, text: string) => Promise<void>) => {
    const db = createDb(appPool);
    const phones = new PhoneCipher(testEnv().PHONE_ENC_KEY);
    return {
      db,
      users: new UsersRepository(db, testEnv().AUTH_SECRET, phones),
      phones,
      sender: { send },
      siteUrl: 'http://127.0.0.1:8080',
      now: () => new Date(),
    };
  };
  const newsFor = async (userId: string, n: number): Promise<number[]> =>
    (
      await owner.query<{ id: string }>(
        `INSERT INTO notifications (user_id, kind, data_date, title, body)
         SELECT $1, 'price_threshold', DATE '2030-01-01' + g, 'Kabar ' || g, 'Isi'
         FROM generate_series(1, $2::int) g RETURNING id`,
        [userId, n],
      )
    ).rows.map((r) => Number(r.id));

  it('a failed send leaves the news unsent and uncounted, so the retry delivers them', async () => {
    const a = await account('sari@contoh.id');
    await connect(a);
    const ids = await newsFor(a.id, 2);
    const failing = deps(() => Promise.reject(new Error('smtp down')));
    await expect(
      deliver({ kind: 'alerts', userId: a.id, notificationIds: ids }, failing),
    ).rejects.toThrow();
    const unsent = await owner.query(
      'SELECT count(*)::int AS n FROM notifications WHERE sent_whatsapp_at IS NULL',
    );
    expect(unsent.rows[0]).toEqual({ n: 2 });
    const texts: string[] = [];
    const ok = deps((_to, text) => {
      texts.push(text);
      return Promise.resolve();
    });
    expect(await deliver({ kind: 'alerts', userId: a.id, notificationIds: ids }, ok)).toBe('sent');
    expect(texts).toHaveLength(1);
  });

  it('parallel jobs for one user never pass the daily cap', async () => {
    const a = await account('sari@contoh.id');
    await connect(a);
    let sent = 0;
    const counting = deps(() => {
      sent += 1;
      return Promise.resolve();
    });
    // Eight news items (each its own data date, the idempotency key), sent by 8 parallel jobs.
    const jobs = await newsFor(a.id, 8);
    await Promise.all(
      jobs.map((id) => deliver({ kind: 'alerts', userId: a.id, notificationIds: [id] }, counting)),
    );
    expect(sent).toBe(MESSAGES_PER_DAY);
  });
});

describe('hand-over to WhatsApp survives a failed enqueue (review 2C, Important 5)', () => {
  it('pendingNews lists unsent recent alert news of connected users only', async () => {
    const a = await account('sari@contoh.id');
    await connect(a);
    const b = await account('budi@contoh.id', '+6285799991234'); // not connected
    const insert = (
      userId: string,
      kind: string,
      date: string,
    ): Promise<pg.QueryResult<{ id: string }>> =>
      owner.query<{ id: string }>(
        `INSERT INTO notifications (user_id, kind, data_date, title, body)
         VALUES ($1, $2::notification_kind, $3::date, 'Kabar', 'Isi') RETURNING id`,
        [userId, kind, date],
      );
    const fresh = Number((await insert(a.id, 'price_threshold', '2026-09-30')).rows[0]?.id);
    await insert(a.id, 'weekly', '2026-11-23');
    const sent = Number((await insert(a.id, 'unusual_move', '2026-09-30')).rows[0]?.id);
    await owner.query('UPDATE notifications SET sent_whatsapp_at = now() WHERE id = $1', [sent]);
    const old = Number((await insert(a.id, 'forecast_rise', '2026-09-30')).rows[0]?.id);
    await owner.query(
      "UPDATE notifications SET created_at = now() - interval '1 day' WHERE id = $1",
      [old],
    );
    await insert(b.id, 'price_threshold', '2026-09-30');

    const pending = await new WhatsAppRepository(createDb(appPool)).pendingNews(
      new Date(Date.now() - 6 * 3600 * 1000),
    );
    expect([...pending.entries()]).toEqual([[a.id, [fresh]]]);
  });
});
