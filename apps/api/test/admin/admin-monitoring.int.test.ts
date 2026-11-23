import type { NestFastifyApplication } from '@nestjs/platform-fastify';
import { Queue } from 'bullmq';
import { Redis } from 'ioredis';
import type pg from 'pg';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { promoteBundle } from '../../src/bundles/bundle-promoter.js';
import { createDb } from '../../src/database/client.js';
import { MAIL_QUEUE } from '../../src/modules/mail/mail.queue.js';
import type { MailJob } from '../../src/modules/mail/mail.queue.js';
import { account, call } from '../helpers/accounts.js';
import { fullRows, row, writeBundle } from '../helpers/bundles.js';
import { startApp, testEnv } from '../helpers/test-app.js';
import { poolFor, resetTestDatabase } from '../helpers/test-db.js';

let app: NestFastifyApplication;
let owner: pg.Pool;
let connection: Redis;
let mail: Queue<MailJob>;
let sessions: Redis;

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
  await owner.query('DELETE FROM forecasts');
  await owner.query('DELETE FROM forecast_artifacts');
  await owner.query('DELETE FROM ingest_runs');
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

describe('monitoring in admin (Fase 3B task 5)', () => {
  it('shows ingest runs, bundles with reject reasons, and queue counts without job data', async () => {
    await owner.query(
      `INSERT INTO ingest_runs (source, status, rows_inserted, rows_skipped, rows_rejected, error, finished_at)
       VALUES ('seed_csv', 'succeeded', 120, 3, 0, NULL, now()),
              ('seed_csv', 'failed', 0, 0, 0, 'header missing', now())`,
    );
    const issued = '2026-11-20T00:00:00Z';
    const now = new Date('2026-11-23T00:00:00Z');
    await promoteBundle(
      createDb(owner),
      await writeBundle({ bundleId: 'ok-1', issuedAt: issued, rows: fullRows() }),
      now,
    );
    await promoteBundle(
      createDb(owner),
      await writeBundle({ bundleId: 'bad-1', issuedAt: issued, rows: [row({ horizon_days: 2 })] }),
      now,
    );
    // A queued e-mail holds an address: only counts may leave the API.
    await mail.add('verify_email', {
      template: 'verify_email',
      to: 'rahasia@contoh.id',
      token: 't',
    });

    const ad = await account(app, mail, owner, 'admin@contoh.id', { role: 'admin' });
    const res = await call(app, 'GET', '/v1/admin/monitoring', ad);
    expect(res.status).toBe(200);
    const body = res.json();
    expect(body['ingestRuns']).toEqual([
      expect.objectContaining({ status: 'failed', error: 'header missing', rowsInserted: 0 }),
      expect.objectContaining({ status: 'succeeded', rowsInserted: 120, rowsSkipped: 3 }),
    ]);
    expect(body['bundles']).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ bundleId: 'ok-1', status: 'active', rejectReasons: [] }),
        expect.objectContaining({
          bundleId: 'bad-1',
          status: 'rejected',
          rejectReasons: expect.arrayContaining(['schema']) as string[],
        }),
      ]),
    );
    expect(body['queues']).toEqual([
      expect.objectContaining({ name: 'mail' }),
      expect.objectContaining({ name: 'alerts' }),
      expect.objectContaining({ name: 'whatsapp' }),
    ]);
    const mailQueue = (body['queues'] as { name: string; waiting: number }[])[0];
    // The admin's own verification mail is queued too (registered above).
    expect(mailQueue?.waiting).toBeGreaterThanOrEqual(1);
    expect(res.body).not.toContain('rahasia@contoh.id');
    expect(res.body).not.toContain('admin@contoh.id');
  });

  it('is admin-only', async () => {
    const u = await account(app, mail, owner, 'biasa@contoh.id');
    expect((await call(app, 'GET', '/v1/admin/monitoring', u)).status).toBe(403);
  });
});
