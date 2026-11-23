import { Writable } from 'node:stream';
import type { NestFastifyApplication } from '@nestjs/platform-fastify';
import { Queue } from 'bullmq';
import { Redis } from 'ioredis';
import type pg from 'pg';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { grantRole } from '../../src/cli/grant-role.js';
import { createDb } from '../../src/database/client.js';
import { AnalystRepository } from '../../src/modules/analyst/analyst.repository.js';
import { MAIL_QUEUE } from '../../src/modules/mail/mail.queue.js';
import type { MailJob } from '../../src/modules/mail/mail.queue.js';
import { loadObservations } from '../helpers/fixtures.js';
import { poolFor, resetTestDatabase } from '../helpers/test-db.js';
import { serviceToken, startApp, testEnv } from '../helpers/test-app.js';

const PASSWORD = 'pasar kramat jati pagi hari';
let app: NestFastifyApplication;
let owner: pg.Pool;
let appPool: pg.Pool;
let connection: Redis;
let mailQueue: Queue<MailJob>;
let sessions: Redis;
const logLines: string[] = [];

interface Reply {
  status: number;
  body: string;
  headers: Record<string, string | string[] | number | undefined>;
  json: () => Record<string, unknown>;
}

async function call(
  method: 'GET' | 'POST',
  url: string,
  o: { body?: unknown; session?: string; csrf?: string } = {},
): Promise<Reply> {
  const res = await app.inject({
    method,
    url,
    headers: {
      'x-service-token': serviceToken(),
      'x-forwarded-for': '10.7.7.7',
      ...(o.session === undefined ? {} : { 'x-session-token': o.session }),
      ...(o.csrf === undefined ? {} : { 'x-csrf-token': o.csrf }),
    },
    ...(o.body === undefined ? {} : { payload: o.body as object }),
  });
  return {
    status: res.statusCode,
    body: res.body,
    headers: res.headers,
    json: () => res.json<Record<string, unknown>>(),
  };
}

async function account(email: string, verify = true) {
  await call('POST', '/v1/auth/register', {
    body: { email, password: PASSWORD, acceptPrivacy: true },
  });
  if (verify) {
    const jobs = await mailQueue.getJobs(['waiting', 'delayed', 'completed', 'failed', 'active']);
    const v = jobs.map((j) => j.data).find((d) => d.template === 'verify_email' && d.to === email);
    await call('POST', '/v1/auth/verify-email', { body: { token: v?.token } });
  }
  const login = (
    await call('POST', '/v1/auth/login', { body: { email, password: PASSWORD } })
  ).json();
  return { session: String(login['token']), csrf: String(login['csrf']), email };
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
  sessions = new Redis(env.VALKEY_SESSION_URL);
  await loadObservations(owner, [
    { commodity: 'cabai-merah-keriting', date: '2026-09-29', price: 63_000 },
    { commodity: 'cabai-merah-keriting', date: '2026-09-30', price: 63_150 },
    { commodity: 'bawang-merah', date: '2026-09-30', price: 40_300 },
  ]);
});

beforeEach(async () => {
  await owner.query('DELETE FROM users');
  await owner.query('DELETE FROM audit_log');
  await mailQueue.obliterate({ force: true });
  await sessions.flushdb();
  const cache = new Redis(testEnv().VALKEY_CACHE_URL);
  await cache.flushdb();
  cache.disconnect();
});

afterAll(async () => {
  await mailQueue.close();
  connection.disconnect();
  sessions.disconnect();
  await app.close();
  await appPool.end();
  await owner.end();
});

describe('role CLI (task 1)', () => {
  it('grants and removes analyst, approves the pending request, never touches admin', async () => {
    const a = await account('sari@contoh.id');
    await call('POST', '/v1/analyst/request', {
      ...a,
      body: { reason: 'Skripsi inflasi pangan Jakarta' },
    });
    const db = createDb(appPool);
    expect(await grantRole(db, 'SARI@contoh.id', 'analyst')).toBe('granted');
    expect(await grantRole(db, 'sari@contoh.id', 'analyst')).toBe('unchanged');
    const req = await owner.query('SELECT status FROM analyst_requests');
    expect(req.rows).toEqual([{ status: 'approved' }]);
    expect(await grantRole(db, 'sari@contoh.id', 'user')).toBe('removed');
    await owner.query("UPDATE users SET role = 'admin' WHERE email = 'sari@contoh.id'");
    expect(await grantRole(db, 'sari@contoh.id', 'user')).toBe('refused_admin');
    expect(await grantRole(db, 'tidak@ada.id', 'analyst')).toBe('not_found');
    const audit = await owner.query<{ action: string }>('SELECT action FROM audit_log ORDER BY id');
    expect(audit.rows.map((r) => r.action)).toEqual(['role_request', 'role_grant', 'role_revoke']);
  });
});

describe('analyst request (task 3)', () => {
  it('a verified user requests once; status shows it; unverified users cannot', async () => {
    const a = await account('sari@contoh.id');
    expect((await call('GET', '/v1/analyst', a)).json()).toEqual({
      role: 'user',
      request: null,
      canRequest: true,
    });
    const body = { reason: 'Penelitian harga pangan untuk TPID', organization: 'UMB' };
    expect((await call('POST', '/v1/analyst/request', { session: a.session, body })).status).toBe(
      403,
    );
    expect((await call('POST', '/v1/analyst/request', { ...a, body })).status).toBe(204);
    const again = await call('POST', '/v1/analyst/request', { ...a, body });
    expect(again.json()).toMatchObject({ error: { code: 'conflict', fields: ['pending'] } });
    expect((await call('GET', '/v1/analyst', a)).json()).toMatchObject({
      request: { status: 'pending', note: null },
      canRequest: false,
    });
    const u = await account('baru@contoh.id', false);
    const r = await call('POST', '/v1/analyst/request', { ...u, body });
    expect(r.json()).toMatchObject({ error: { code: 'conflict', fields: ['email'] } });
    expect(
      (await call('POST', '/v1/analyst/request', { ...a, body: { reason: 'x' } })).status,
    ).toBe(400);
  });
});

describe('request vs. a concurrent grant (review finding)', () => {
  it('re-checks role and e-mail under a row lock, so no pending request outlives a grant', async () => {
    const a = await account('sari@contoh.id');
    const id =
      (await owner.query<{ id: string }>("SELECT id FROM users WHERE email = 'sari@contoh.id'"))
        .rows[0]?.id ?? '';
    const repo = new AnalystRepository(createDb(appPool));
    // The service read role=user; the CLI granted analyst before the insert.
    await grantRole(createDb(appPool), a.email, 'analyst');
    expect(await repo.createRequest(id, 'Skripsi inflasi pangan Jakarta', null)).toBe('role');
    await grantRole(createDb(appPool), a.email, 'user');
    expect(typeof (await repo.createRequest(id, 'Skripsi inflasi pangan Jakarta', null))).toBe(
      'number',
    );
    expect(await repo.createRequest(id, 'Skripsi inflasi pangan Jakarta', null)).toBe('pending');
  });
});

describe('CSV exports (tasks 2 and 4)', () => {
  it('need the analyst role, checked on every request', async () => {
    const a = await account('sari@contoh.id');
    expect((await call('GET', '/v1/analyst/export/prices.csv')).status).toBe(401);
    expect((await call('GET', '/v1/analyst/export/prices.csv', a)).json()).toMatchObject({
      error: { code: 'forbidden' },
    });
    await grantRole(createDb(appPool), a.email, 'analyst');
    expect((await call('GET', '/v1/analyst/export/prices.csv', a)).status).toBe(200);
    // Revoked: the same session stops working at once.
    await grantRole(createDb(appPool), a.email, 'user');
    expect((await call('GET', '/v1/analyst/export/prices.csv', a)).status).toBe(403);
  });

  it('prices: header, rows, filters, download headers, BOM, audit entry without e-mail', async () => {
    const a = await account('sari@contoh.id');
    await grantRole(createDb(appPool), a.email, 'analyst');
    const res = await call(
      'GET',
      '/v1/analyst/export/prices.csv?commodities=cabai-merah-keriting&from=2026-09-30',
      a,
    );
    expect(res.headers['content-type']).toBe('text/csv; charset=utf-8');
    expect(res.headers['content-disposition']).toBe('attachment; filename="kawan-pasar-harga.csv"');
    expect(res.headers['cache-control']).toBe('private, no-store');
    expect(res.body.charCodeAt(0)).toBe(0xfeff);
    expect(res.body.slice(1)).toBe(
      'pasar,komoditas,nama,tanggal,harga_idr,sumber\r\n' +
        'PIKJ,cabai-merah-keriting,Cabai merah keriting,2026-09-30,63150,seed_csv\r\n',
    );
    const audit = await owner.query<{ action: string; target: string }>(
      'SELECT action, target FROM audit_log',
    );
    expect(audit.rows).toContainEqual({ action: 'export_prices', target: 'rows:1' });
    expect(logLines.join('')).not.toContain('sari@contoh.id');
    expect((await call('GET', '/v1/analyst/export/prices.csv?commodities=gula', a)).status).toBe(
      400,
    );
  });

  it('forecasts: one row per horizon of the active bundle, or just the header', async () => {
    const a = await account('sari@contoh.id');
    await grantRole(createDb(appPool), a.email, 'analyst');
    const res = await call('GET', '/v1/analyst/export/forecasts.csv', a);
    expect(res.status).toBe(200);
    expect(res.body.slice(1).split('\r\n')[0]).toBe(
      'pasar,komoditas,tanggal_dasar,horizon_hari,q10_perubahan,q50_perubahan,q90_perubahan,q10_harga_idr,q50_harga_idr,q90_harga_idr,status_uji,model,versi_model,data_demo',
    );
  });

  it('allows 30 downloads an hour per account', async () => {
    const a = await account('sari@contoh.id');
    await grantRole(createDb(appPool), a.email, 'analyst');
    for (let i = 0; i < 30; i += 1) {
      expect((await call('GET', '/v1/analyst/export/forecasts.csv', a)).status).toBe(200);
    }
    const r = await call('GET', '/v1/analyst/export/prices.csv', a);
    expect(r.status).toBe(429);
    expect(Number(r.headers['retry-after'])).toBeGreaterThan(0);
  });
});
