import { Writable } from 'node:stream';
import type { NestFastifyApplication } from '@nestjs/platform-fastify';
import { Queue } from 'bullmq';
import { Redis } from 'ioredis';
import type pg from 'pg';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { MAIL_QUEUE } from '../../src/modules/mail/mail.queue.js';
import type { MailJob } from '../../src/modules/mail/mail.queue.js';
import { resolveForgot } from '../../src/modules/mail/forgot.js';
import { createDb } from '../../src/database/client.js';
import { AuthTokenService } from '../../src/modules/auth/auth-token.service.js';
import { PhoneCipher } from '../../src/modules/auth/phone-cipher.js';
import { UsersRepository } from '../../src/modules/auth/users.repository.js';
import { poolFor, resetTestDatabase } from '../helpers/test-db.js';
import { serviceToken, startApp, testEnv } from '../helpers/test-app.js';

const PASSWORD = 'pasar kramat jati pagi hari';
const NEW_PASSWORD = 'harga cabai turun minggu ini';
const EMAIL = 'sari@contoh.id';
const CLIENT_IP = '10.20.30.40';

let app: NestFastifyApplication;
let pool: pg.Pool;
let queue: Queue<MailJob>;
let sessions: Redis;
let queueConnection: Redis;
const logLines: string[] = [];

interface Reply {
  status: number;
  body: string;
  json: () => Record<string, unknown>;
  headers: Record<string, string | string[] | number | undefined>;
}

async function call(
  method: 'GET' | 'POST' | 'PUT' | 'DELETE',
  url: string,
  options: { body?: unknown; session?: string; csrf?: string; ip?: string } = {},
): Promise<Reply> {
  const res = await app.inject({
    method,
    url,
    headers: {
      'x-service-token': serviceToken(),
      'x-forwarded-for': options.ip ?? CLIENT_IP,
      'user-agent': 'Mozilla/5.0 (Windows NT 10.0) Chrome/140',
      ...(options.session === undefined ? {} : { 'x-session-token': options.session }),
      ...(options.csrf === undefined ? {} : { 'x-csrf-token': options.csrf }),
    },
    ...(options.body === undefined ? {} : { payload: options.body as object }),
  });
  return {
    status: res.statusCode,
    body: res.body,
    json: () => res.json<Record<string, unknown>>(),
    headers: res.headers,
  };
}

async function mails(): Promise<MailJob[]> {
  const jobs = await queue.getJobs(['waiting', 'delayed', 'active', 'completed', 'failed']);
  return jobs.map((j) => j.data).filter((d) => d.template !== 'noop');
}

async function register(email = EMAIL, password = PASSWORD): Promise<Reply> {
  return call('POST', '/v1/auth/register', { body: { email, password, acceptPrivacy: true } });
}

async function login(
  email = EMAIL,
  password = PASSWORD,
  ip = CLIENT_IP,
): Promise<{ token: string; csrf: string }> {
  const res = await call('POST', '/v1/auth/login', { body: { email, password }, ip });
  expect(res.status).toBe(200);
  const body = res.json();
  return { token: String(body['token']), csrf: String(body['csrf']) };
}

async function verifyAccount(): Promise<void> {
  const job = (await mails()).find((m) => m.template === 'verify_email');
  expect(
    (await call('POST', '/v1/auth/verify-email', { body: { token: job?.token } })).status,
  ).toBe(204);
}

beforeAll(async () => {
  await resetTestDatabase();
  pool = poolFor('app');
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
  queueConnection = new Redis(env.VALKEY_QUEUE_URL, { maxRetriesPerRequest: null });
  queue = new Queue<MailJob>(MAIL_QUEUE, { connection: queueConnection });
  sessions = new Redis(env.VALKEY_SESSION_URL);
});

beforeEach(async () => {
  await pool.query('DELETE FROM users');
  await pool.query('DELETE FROM auth_events');
  await queue.obliterate({ force: true });
  await sessions.flushdb();
  // Rate-limit counters of the API (cache Valkey, test database 15).
  const cache = new Redis(testEnv().VALKEY_CACHE_URL);
  await cache.flushdb();
  cache.disconnect();
});

afterAll(async () => {
  await queue.close();
  queueConnection.disconnect();
  sessions.disconnect();
  await app.close();
  await pool.end();
});

describe('register', () => {
  it('answers "check your e-mail" and sends a verification link', async () => {
    const res = await register();
    expect(res.status).toBe(202);
    expect(res.json()).toEqual({ status: 'check_email' });
    const { rows } = await pool.query<{ password_hash: string; email_verified_at: Date | null }>(
      'SELECT password_hash, email_verified_at FROM users',
    );
    expect(rows[0]?.password_hash).toMatch(/^\$argon2id\$/);
    expect(rows[0]?.email_verified_at).toBeNull();
    const sent = await mails();
    expect(sent).toHaveLength(1);
    expect(sent[0]).toMatchObject({ template: 'verify_email', to: EMAIL });
    expect(sent[0]?.token).toMatch(/^[A-Za-z0-9_-]{43}$/);
  });

  it('answers the same for an address that already has an account, and tells its owner', async () => {
    const first = await register();
    const second = await register('SARI@Contoh.id', 'kalimat lain yang panjang');
    expect(second.status).toBe(first.status);
    expect(second.body).toBe(first.body);
    const { rowCount } = await pool.query('SELECT 1 FROM users');
    expect(rowCount).toBe(1);
    expect((await mails()).map((m) => m.template).sort()).toEqual([
      'already_registered',
      'verify_email',
    ]);
  });

  it('refuses a breached or e-mail-like password before looking the address up', async () => {
    const res = await register(EMAIL, 'qwertyuiopasdfghjkl');
    expect(res.status).toBe(422);
    expect(res.json()).toEqual({
      error: { code: 'weak_password', message: 'breached', fields: ['password'] },
    });
    expect((await register(EMAIL, EMAIL.padEnd(14, ' '))).status).toBe(422);
  });

  it('validates the contract (strict, privacy acceptance required)', async () => {
    const res = await call('POST', '/v1/auth/register', {
      body: { email: EMAIL, password: PASSWORD, acceptPrivacy: false },
    });
    expect(res.status).toBe(400);
  });
});

describe('login', () => {
  it('gives a session that identifies the user', async () => {
    await register();
    const { token, csrf } = await login();
    expect(token).not.toBe(csrf);
    const me = await call('GET', '/v1/me', { session: token });
    expect(me.status).toBe(200);
    expect(me.json()).toMatchObject({ email: EMAIL, emailVerified: false, csrf });
    expect(me.headers['cache-control']).toBe('private, no-store');
  });

  it('answers a wrong password and an unknown address identically', async () => {
    await register();
    const wrong = await call('POST', '/v1/auth/login', {
      body: { email: EMAIL, password: 'salah sekali kata sandinya' },
    });
    const unknown = await call('POST', '/v1/auth/login', {
      body: { email: 'tidak.ada@contoh.id', password: PASSWORD },
    });
    expect(wrong.status).toBe(401);
    expect(unknown.status).toBe(401);
    expect(wrong.body).toBe(unknown.body);
    expect(wrong.json()).toEqual({
      error: { code: 'invalid_credentials', message: 'invalid credentials' },
    });
  });

  it('locks the account after 5 failures, even for the right password', async () => {
    await register();
    for (let i = 0; i < 5; i += 1) {
      await call('POST', '/v1/auth/login', {
        body: { email: EMAIL, password: `salah ${String(i)} kata sandi` },
        ip: `10.0.0.${String(i + 1)}`,
      });
    }
    const res = await call('POST', '/v1/auth/login', {
      body: { email: EMAIL, password: PASSWORD },
      ip: '10.0.0.99',
    });
    expect(res.status).toBe(429);
    expect(res.json()).toMatchObject({ error: { code: 'locked' } });
    expect(Number(res.headers['retry-after'])).toBeGreaterThan(0);
  });

  it('limits sign-in attempts per client address to 10 per minute', async () => {
    // Fixed one-minute windows on the real clock: 11 attempts that straddle a minute boundary
    // split across two windows (seen once in the Fase 2B audit). Start clear of the boundary.
    const intoMinute = Date.now() % 60_000;
    if (intoMinute > 55_000) await new Promise((r) => setTimeout(r, 60_500 - intoMinute));
    const statuses: number[] = [];
    for (let i = 0; i < 11; i += 1) {
      const res = await call('POST', '/v1/auth/login', {
        body: { email: `orang${String(i)}@contoh.id`, password: PASSWORD },
      });
      statuses.push(res.status);
    }
    expect(statuses.slice(0, 10).every((s) => s === 401)).toBe(true);
    expect(statuses[10]).toBe(429);
  });

  it('signing in again on the same device ends the previous session there', async () => {
    await register();
    const first = await login();
    const res = await call('POST', '/v1/auth/login', {
      body: { email: EMAIL, password: PASSWORD },
      session: first.token,
    });
    expect(res.status).toBe(200);
    expect((await call('GET', '/v1/me', { session: first.token })).status).toBe(401);
    expect((await call('GET', '/v1/me', { session: String(res.json()['token']) })).status).toBe(
      200,
    );
  });

  it('logout ends the session', async () => {
    await register();
    const s = await login();
    expect((await call('POST', '/v1/auth/logout', { session: s.token, csrf: s.csrf })).status).toBe(
      204,
    );
    expect((await call('GET', '/v1/me', { session: s.token })).status).toBe(401);
  });
});

describe('e-mail verification', () => {
  it('verifies once with the e-mailed token', async () => {
    await register();
    const token = (await mails())[0]?.token;
    expect((await call('POST', '/v1/auth/verify-email', { body: { token } })).status).toBe(204);
    const s = await login();
    expect((await call('GET', '/v1/me', { session: s.token })).json()).toMatchObject({
      emailVerified: true,
    });
    const again = await call('POST', '/v1/auth/verify-email', { body: { token } });
    expect(again.status).toBe(400);
    expect(again.json()).toMatchObject({ error: { code: 'invalid_token' } });
  });

  it('resend answers the same whether or not the address is verified', async () => {
    await register();
    const s = await login();
    const before = await call('POST', '/v1/auth/resend-verification', {
      session: s.token,
      csrf: s.csrf,
    });
    expect(before.status).toBe(202);
    await verifyAccount();
    const after = await call('POST', '/v1/auth/resend-verification', {
      session: s.token,
      csrf: s.csrf,
    });
    expect(after.status).toBe(202);
    expect(after.body).toBe(before.body);
  });
});

describe('password reset', () => {
  it('answers the same for known and unknown addresses', async () => {
    await register();
    const known = await call('POST', '/v1/auth/forgot-password', { body: { email: EMAIL } });
    const unknown = await call('POST', '/v1/auth/forgot-password', {
      body: { email: 'tidak.ada@contoh.id' },
    });
    expect(known.status).toBe(202);
    expect(unknown.body).toBe(known.body);
    // The API does the same for both: one queued job, no token yet (the worker resolves it).
    const jobs = (await mails()).filter((m) => m.template === 'forgot_password');
    expect(jobs.map((j) => j.to).sort()).toEqual([EMAIL, 'tidak.ada@contoh.id']);
    expect(
      (await pool.query('SELECT 1 FROM auth_tokens WHERE purpose = $1', ['reset_password']))
        .rowCount,
    ).toBe(0);
  });

  it('takes about as long for known and unknown addresses (no timing oracle)', async () => {
    await register();
    const time = async (email: string): Promise<number> => {
      const started = performance.now();
      await call('POST', '/v1/auth/forgot-password', {
        body: { email },
        ip: `10.9.${String(Math.floor(Math.random() * 250))}.${String(Math.floor(Math.random() * 250))}`,
      });
      return performance.now() - started;
    };
    const median = (xs: number[]): number =>
      [...xs].sort((a, b) => a - b)[Math.floor(xs.length / 2)] ?? 0;
    const known: number[] = [];
    const unknown: number[] = [];
    for (let i = 0; i < 20; i += 1) {
      known.push(await time(i % 2 === 0 ? EMAIL : 'SARI@contoh.id'));
      unknown.push(await time(`orang${String(i)}@contoh.id`));
      await sessions.flushdb(); // per-e-mail limits would otherwise kick in
    }
    expect(Math.abs(median(known) - median(unknown))).toBeLessThan(30);
  });

  it('resets once, ends every session, and the new password works', async () => {
    await register();
    const old = await login();
    await call('POST', '/v1/auth/forgot-password', { body: { email: EMAIL } });
    // What the worker does with the queued job (issue the token, prepare the e-mail).
    const job = (await mails()).find((m) => m.template === 'forgot_password');
    const resolved = await resolveForgot(job ?? { template: 'noop' }, {
      users: new UsersRepository(
        createDb(pool),
        testEnv().AUTH_SECRET,
        new PhoneCipher(testEnv().PHONE_ENC_KEY),
      ),
      tokens: new AuthTokenService(createDb(pool), { now: () => new Date() }),
      now: () => new Date(),
    });
    expect(resolved?.template).toBe('reset_password');
    const token = resolved?.token;

    const weak = await call('POST', '/v1/auth/reset-password', {
      body: { token, password: 'qwertyuiopasdfghjkl' },
    });
    expect(weak.status).toBe(422);
    const done = await call('POST', '/v1/auth/reset-password', {
      body: { token, password: NEW_PASSWORD },
    });
    expect(done.status).toBe(204);
    expect((await call('GET', '/v1/me', { session: old.token })).status).toBe(401);
    await login(EMAIL, NEW_PASSWORD);
    const again = await call('POST', '/v1/auth/reset-password', {
      body: { token, password: 'kalimat sandi ketiga ini' },
    });
    expect(again.status).toBe(400);
  });
});

describe('account (session + CSRF)', () => {
  it('needs a session; the service token alone is not enough', async () => {
    const res = await call('GET', '/v1/me');
    expect(res.status).toBe(401);
    expect(res.json()).toMatchObject({ error: { code: 'unauthenticated' } });
  });

  it('refuses mutations without the right CSRF token', async () => {
    await register();
    const s = await login();
    const body = { current: PASSWORD, next: NEW_PASSWORD };
    const missing = await call('POST', '/v1/me/password', { session: s.token, body });
    const wrong = await call('POST', '/v1/me/password', {
      session: s.token,
      csrf: 'x'.repeat(43),
      body,
    });
    expect([missing.status, wrong.status]).toEqual([403, 403]);
    expect(missing.json()).toMatchObject({ error: { code: 'csrf' } });
  });

  it('changing the password ends the other sessions and tells the owner', async () => {
    await register();
    const here = await login();
    const there = await login(EMAIL, PASSWORD, '10.1.1.1');
    const wrongCurrent = await call('POST', '/v1/me/password', {
      session: here.token,
      csrf: here.csrf,
      body: { current: 'bukan kata sandi lama', next: NEW_PASSWORD },
    });
    expect(wrongCurrent.status).toBe(401);
    const res = await call('POST', '/v1/me/password', {
      session: here.token,
      csrf: here.csrf,
      body: { current: PASSWORD, next: NEW_PASSWORD },
    });
    expect(res.status).toBe(204);
    expect((await call('GET', '/v1/me', { session: here.token })).status).toBe(200);
    expect((await call('GET', '/v1/me', { session: there.token })).status).toBe(401);
    expect((await mails()).map((m) => m.template)).toContain('password_changed');
  });

  it('lists the sessions and revokes another one', async () => {
    await register();
    const here = await login();
    const there = await login(EMAIL, PASSWORD, '10.1.1.1');
    const list = await call('GET', '/v1/me/sessions', { session: here.token });
    const items = list.json()['items'] as { id: string; current: boolean; device: string }[];
    expect(items).toHaveLength(2);
    expect(items.find((i) => i.current)?.device).toBe('Chrome · Windows');
    const other = items.find((i) => !i.current)?.id ?? '';
    const revoke = await call('DELETE', `/v1/me/sessions/${other}`, {
      session: here.token,
      csrf: here.csrf,
    });
    expect(revoke.status).toBe(204);
    expect((await call('GET', '/v1/me', { session: there.token })).status).toBe(401);
  });

  it('deletes the account with its password, and keeps an anonymous audit trail', async () => {
    await register();
    const s = await login();
    const wrong = await call('DELETE', '/v1/me', {
      session: s.token,
      csrf: s.csrf,
      body: { password: 'bukan kata sandinya' },
    });
    expect(wrong.status).toBe(401);
    const res = await call('DELETE', '/v1/me', {
      session: s.token,
      csrf: s.csrf,
      body: { password: PASSWORD },
    });
    expect(res.status).toBe(204);
    expect((await call('GET', '/v1/me', { session: s.token })).status).toBe(401);
    expect((await pool.query('SELECT 1 FROM users')).rowCount).toBe(0);
    const events = await pool.query<{ user_id: string | null; type: string }>(
      'SELECT user_id, type FROM auth_events',
    );
    expect(events.rows.every((e) => e.user_id === null)).toBe(true);
    expect(events.rows.map((e) => e.type)).toContain('account_delete');
    expect((await mails()).map((m) => m.template)).toContain('account_deleted');
  });
});

describe('mobile number (optional, encrypted)', () => {
  const PHONE = '+6281234567890';

  async function rawPhone(): Promise<Record<string, unknown> | undefined> {
    const r = await pool.query<Record<string, unknown>>(
      'SELECT phone_nonce, phone_ciphertext, phone_hmac FROM users WHERE email = $1',
      [EMAIL],
    );
    return r.rows[0];
  }

  it('can be given at sign-up; stored encrypted, shown masked', async () => {
    const res = await call('POST', '/v1/auth/register', {
      body: { email: EMAIL, password: PASSWORD, phone: '0812-3456-7890', acceptPrivacy: true },
    });
    expect(res.status).toBe(202);
    const row = await rawPhone();
    expect(row?.['phone_ciphertext']).toBeInstanceOf(Buffer);
    expect(Buffer.from(row?.['phone_ciphertext'] as Buffer).toString('latin1')).not.toContain(
      '81234567890',
    );
    const s = await login();
    const me = (await call('GET', '/v1/me', { session: s.token })).json();
    expect(me['phone']).toBe('+62 812 •••• 7890');
  });

  it('is optional, and an invalid number is refused', async () => {
    await register();
    expect((await rawPhone())?.['phone_ciphertext']).toBeNull();
    const s = await login();
    expect((await call('GET', '/v1/me', { session: s.token })).json()['phone']).toBeNull();
    const bad = await call('POST', '/v1/auth/register', {
      body: {
        email: 'lain@contoh.id',
        password: PASSWORD,
        phone: '021-555-1234',
        acceptPrivacy: true,
      },
    });
    expect(bad.status).toBe(400);
  });

  it('a sign-up for an existing address does not change its number', async () => {
    await register();
    await call('POST', '/v1/auth/register', {
      body: { email: EMAIL, password: PASSWORD, phone: PHONE, acceptPrivacy: true },
    });
    expect((await rawPhone())?.['phone_ciphertext']).toBeNull();
  });

  it('the owner can set, replace and remove it (session + CSRF)', async () => {
    await register();
    const s = await login();
    const opts = { session: s.token, csrf: s.csrf };
    expect((await call('PUT', '/v1/me/phone', { body: { phone: PHONE } })).status).toBe(401);
    expect(
      (await call('PUT', '/v1/me/phone', { session: s.token, body: { phone: PHONE } })).status,
    ).toBe(403);
    expect((await call('PUT', '/v1/me/phone', { ...opts, body: { phone: PHONE } })).status).toBe(
      204,
    );
    expect((await call('GET', '/v1/me', opts)).json()['phone']).toBe('+62 812 •••• 7890');
    expect(
      (await call('PUT', '/v1/me/phone', { ...opts, body: { phone: '085799991234' } })).status,
    ).toBe(204);
    expect((await call('GET', '/v1/me', opts)).json()['phone']).toBe('+62 857 •••• 1234');
    expect((await call('PUT', '/v1/me/phone', { ...opts, body: { phone: 'abc' } })).status).toBe(
      400,
    );
    expect((await call('DELETE', '/v1/me/phone', opts)).status).toBe(204);
    expect((await call('GET', '/v1/me', opts)).json()['phone']).toBeNull();
    expect((await rawPhone())?.['phone_hmac']).toBeNull();
    const events = await pool.query(
      "SELECT count(*)::int AS n FROM auth_events WHERE type = 'phone_change'",
    );
    expect(events.rows[0]).toEqual({ n: 2 + 1 });
  });

  it('never appears in the logs', async () => {
    await call('POST', '/v1/auth/register', {
      body: { email: EMAIL, password: PASSWORD, phone: PHONE, acceptPrivacy: true },
    });
    const all = logLines.join('');
    for (const form of ['81234567890', '0812-3456-7890']) expect(all).not.toContain(form);
  });
});

describe('logs', () => {
  it('never contain e-mail addresses, passwords or tokens', async () => {
    await register();
    const s = await login();
    await call('GET', '/v1/me', { session: s.token });
    const all = logLines.join('');
    expect(all.length).toBeGreaterThan(0);
    for (const secret of [EMAIL, PASSWORD, s.token, s.csrf]) expect(all).not.toContain(secret);
  });
});
