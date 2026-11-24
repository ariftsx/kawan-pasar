import type { NestFastifyApplication } from '@nestjs/platform-fastify';
import { Queue } from 'bullmq';
import { Redis } from 'ioredis';
import type pg from 'pg';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { MAIL_QUEUE } from '../../src/modules/mail/mail.queue.js';
import type { MailJob } from '../../src/modules/mail/mail.queue.js';
import { account, call } from '../helpers/accounts.js';
import { startApp, testEnv } from '../helpers/test-app.js';
import { poolFor, resetTestDatabase } from '../helpers/test-db.js';

let app: NestFastifyApplication;
let owner: pg.Pool;
let connection: Redis;
let mail: Queue<MailJob>;
let sessions: Redis;

const CANDIDATE = {
  runId: '20261207T030000Z',
  bundleId: 'arifnet-2026-12-04-202612070330-1a2b3c4d',
  bundleSha256: 'a'.repeat(64),
  modelVersion: 'arifnet-a0-kp-20261207T030000Z',
  dataEnd: '2026-12-04',
  lockOpen: true,
  commodities: ['cabai-merah-keriting', 'beras-medium-1', 'cabai-rawit-hijau'],
  overallRelmae: 0.867,
  scores: { 'cabai-merah-keriting': { '1': 1, '365': 0.6309 }, 'beras-medium-1': { '90': 2.518 } },
  window: { start: '2024-12-04', end: '2025-12-04' },
};

const register = (body: unknown) => call(app, 'POST', '/internal/model-candidates', { body });

beforeAll(async () => {
  await resetTestDatabase();
  owner = poolFor('owner');
  const env = testEnv();
  app = await startApp({ env });
  connection = new Redis(env.VALKEY_QUEUE_URL, { maxRetriesPerRequest: null });
  mail = new Queue<MailJob>(MAIL_QUEUE, { connection });
  sessions = new Redis(env.VALKEY_SESSION_URL);
});

beforeEach(async () => {
  await owner.query('DELETE FROM users');
  await owner.query('DELETE FROM model_candidates');
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

describe('model candidates (Fase 4B task 5)', () => {
  it('registering the same run again is idempotent; a different bundle is a conflict', async () => {
    const first = await register(CANDIDATE);
    expect(first.status).toBe(201);
    const id = (first.json() as { id: number }).id;
    // An Airflow retry sends the same registration: same id, no new row.
    const again = await register(CANDIDATE);
    expect(again.status).toBe(200);
    expect(again.json()).toEqual({ id });
    // Same run id, another bundle: never silently accepted.
    const otherBundle = await register({ ...CANDIDATE, bundleSha256: 'b'.repeat(64) });
    expect(otherBundle.status).toBe(409);
    // Another run claiming an existing bundle id: a conflict too.
    const otherRun = await register({ ...CANDIDATE, runId: '20261208T030000Z' });
    expect(otherRun.status).toBe(409);
    const rows = await owner.query<{ status: string; overall_relmae: string }>(
      'SELECT status, overall_relmae FROM model_candidates',
    );
    expect(rows.rows).toEqual([{ status: 'pending', overall_relmae: '0.8670' }]);
  });

  it('needs the service token and a valid body', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/internal/model-candidates',
      payload: CANDIDATE,
    });
    expect(res.statusCode).toBe(401);
    expect((await register({ ...CANDIDATE, runId: '../x' })).status).toBe(400);
    expect((await register({ ...CANDIDATE, commodities: ['gula'] })).status).toBe(400);
    // Protocol: a candidate trained while the lock was closed has data up to 2026-09-30 only.
    expect((await register({ ...CANDIDATE, lockOpen: false })).status).toBe(400);
  });

  it('admins list candidates newest first; other users cannot', async () => {
    await register(CANDIDATE);
    await register({ ...CANDIDATE, runId: '20261214T030000Z', bundleId: 'arifnet-2026-12-11-x' });
    const ad = await account(app, mail, owner, 'admin@contoh.id', { role: 'admin' });
    const list = (await call(app, 'GET', '/v1/admin/model-candidates', ad)).json();
    expect((list['items'] as { runId: string }[]).map((c) => c.runId)).toEqual([
      '20261214T030000Z',
      '20261207T030000Z',
    ]);
    expect((list['items'] as Record<string, unknown>[])[1]).toMatchObject({
      status: 'pending',
      overallRelmae: 0.867,
      dataEnd: '2026-12-04',
      window: { start: '2024-12-04', end: '2025-12-04' },
      scores: { 'beras-medium-1': { '90': 2.518 } },
    });
    const u = await account(app, mail, owner, 'biasa@contoh.id');
    expect((await call(app, 'GET', '/v1/admin/model-candidates', u)).status).toBe(403);
  });

  it('the app cannot delete candidates', async () => {
    await register(CANDIDATE);
    const appPool = poolFor('app');
    try {
      await expect(appPool.query('DELETE FROM model_candidates')).rejects.toMatchObject({
        code: '42501',
      });
    } finally {
      await appPool.end();
    }
  });
});
