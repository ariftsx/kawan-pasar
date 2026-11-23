import type { NestFastifyApplication } from '@nestjs/platform-fastify';
import { Queue } from 'bullmq';
import { Redis } from 'ioredis';
import type pg from 'pg';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { MAIL_QUEUE } from '../../src/modules/mail/mail.queue.js';
import type { MailJob } from '../../src/modules/mail/mail.queue.js';
import { PASSWORD, account, call } from '../helpers/accounts.js';
import { fixedClock, startApp, testEnv } from '../helpers/test-app.js';
import { poolFor, resetTestDatabase } from '../helpers/test-db.js';

const START = '2026-11-23T09:00:00+07:00';
const clock = fixedClock(START);
let app: NestFastifyApplication;
let owner: pg.Pool;
let connection: Redis;
let mail: Queue<MailJob>;
let sessions: Redis;

const at = (minutes: number): string =>
  new Date(Date.parse(START) + minutes * 60_000).toISOString();

beforeAll(async () => {
  await resetTestDatabase();
  owner = poolFor('owner');
  const env = testEnv();
  app = await startApp({ env, clock });
  connection = new Redis(env.VALKEY_QUEUE_URL, { maxRetriesPerRequest: null });
  mail = new Queue<MailJob>(MAIL_QUEUE, { connection });
  sessions = new Redis(env.VALKEY_SESSION_URL);
});

beforeEach(async () => {
  clock.set(START);
  await owner.query('DELETE FROM users');
  await owner.query('DELETE FROM audit_log');
  await mail.obliterate({ force: true });
  await sessions.flushdb();
});

afterAll(async () => {
  await mail.close();
  connection.disconnect();
  sessions.disconnect();
  await app.close();
  await owner.end();
});

describe('admin guard (Fase 3B task 2)', () => {
  it('only admins pass; the role is read from the database on every request', async () => {
    expect((await call(app, 'GET', '/v1/admin')).status).toBe(401);
    const u = await account(app, mail, owner, 'biasa@contoh.id');
    const a = await account(app, mail, owner, 'analis@contoh.id', { role: 'analyst' });
    const ad = await account(app, mail, owner, 'admin@contoh.id', { role: 'admin' });
    expect((await call(app, 'GET', '/v1/admin', u)).json()).toMatchObject({
      error: { code: 'forbidden' },
    });
    expect((await call(app, 'GET', '/v1/admin', a)).status).toBe(403);
    expect((await call(app, 'GET', '/v1/admin', ad)).json()).toEqual({ confirmedUntil: null });
    await owner.query("UPDATE users SET role = 'user' WHERE email = 'admin@contoh.id'");
    expect((await call(app, 'GET', '/v1/admin', ad)).status).toBe(403);
  });

  it('an admin session ends 12 hours after sign-in, even when active', async () => {
    const ad = await account(app, mail, owner, 'admin@contoh.id', { role: 'admin' });
    for (const m of [60, 170, 280, 390, 500, 610, 719]) {
      clock.set(at(m));
      expect((await call(app, 'GET', '/v1/admin', ad)).status).toBe(200);
    }
    expect((await call(app, 'GET', '/v1/me', ad)).status).toBe(200);
    clock.set(at(721));
    expect((await call(app, 'GET', '/v1/admin', ad)).status).toBe(401);
    // The whole session is ended, not just its admin part.
    expect((await call(app, 'GET', '/v1/me', ad)).status).toBe(401);
  });

  it('an admin session ends after 2 hours without admin activity', async () => {
    const ad = await account(app, mail, owner, 'admin@contoh.id', { role: 'admin' });
    clock.set(at(100));
    expect((await call(app, 'GET', '/v1/admin', ad)).status).toBe(200);
    clock.set(at(100 + 121));
    expect((await call(app, 'GET', '/v1/admin', ad)).status).toBe(401);
  });

  it('confirming the password opens a 10-minute window and is audited', async () => {
    const ad = await account(app, mail, owner, 'admin@contoh.id', { role: 'admin' });
    const wrong = await call(app, 'POST', '/v1/admin/confirm', {
      ...ad,
      body: { password: 'bukan sandi yang benar' },
    });
    expect(wrong.json()).toMatchObject({ error: { code: 'invalid_credentials' } });
    // CSRF is required.
    const noCsrf = await call(app, 'POST', '/v1/admin/confirm', {
      session: ad.session,
      body: { password: PASSWORD },
    });
    expect(noCsrf.status).toBe(403);
    expect(
      (await call(app, 'POST', '/v1/admin/confirm', { ...ad, body: { password: PASSWORD } }))
        .status,
    ).toBe(204);
    expect((await call(app, 'GET', '/v1/admin', ad)).json()).toEqual({
      confirmedUntil: at(10),
    });
    clock.set(at(11));
    expect((await call(app, 'GET', '/v1/admin', ad)).json()).toEqual({ confirmedUntil: null });
    const audit = await owner.query<{ action: string }>('SELECT action FROM audit_log');
    expect(audit.rows).toEqual([{ action: 'admin_confirm' }]);
  });

  it('wrong passwords count toward the account lockout (5 → locked, like sign-in)', async () => {
    const ad = await account(app, mail, owner, 'admin@contoh.id', { role: 'admin' });
    const attempt = async (password: string): Promise<number> =>
      (await call(app, 'POST', '/v1/admin/confirm', { ...ad, body: { password } })).status;
    for (let i = 0; i < 5; i += 1) expect(await attempt(`salah ${String(i)}`)).toBe(401);
    // Locked now: even the right password is refused.
    expect(await attempt(PASSWORD)).toBe(429);
  });
});

describe('sign-in notice for admins (Fase 3B task 7)', () => {
  it('e-mails an admin on each sign-in (device and WIB time, no address), not other users', async () => {
    await account(app, mail, owner, 'admin@contoh.id', { role: 'admin' });
    await account(app, mail, owner, 'biasa@contoh.id');
    const jobs = (await mail.getJobs(['waiting', 'delayed', 'completed', 'failed', 'active'])).map(
      (j) => j.data,
    );
    const notices = jobs.filter((j) => j.template === 'admin_sign_in');
    expect(notices).toHaveLength(1);
    expect(notices[0]?.to).toBe('admin@contoh.id');
    expect(notices[0]?.lines).toEqual(['Perangkat lain', '23 November 2026 09.00 WIB']);
    expect(JSON.stringify(notices[0])).not.toContain('10.7.7.7');
  });
});
