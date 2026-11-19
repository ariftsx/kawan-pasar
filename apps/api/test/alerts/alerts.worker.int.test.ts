import { Queue, QueueEvents } from 'bullmq';
import { Redis } from 'ioredis';
import type pg from 'pg';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createDb } from '../../src/database/client.js';
import { ALERTS_QUEUE } from '../../src/modules/alerts/alerts.queue.js';
import { startAlertsWorker } from '../../src/modules/alerts/alerts.worker.js';
import type { AlertsWorker } from '../../src/modules/alerts/alerts.worker.js';
import { AuthTokenService } from '../../src/modules/auth/auth-token.service.js';
import { loadObservations, weekdays } from '../helpers/fixtures.js';
import { poolFor, resetTestDatabase } from '../helpers/test-db.js';
import { testEnv } from '../helpers/test-app.js';

const HASH =
  '$argon2id$v=19$m=19456,t=2,p=1$c2FsdHNhbHRzYWx0$aGFzaGhhc2hoYXNoaGFzaGhhc2hoYXNoaGFzaA';

let owner: pg.Pool;
let app: pg.Pool;
let worker: AlertsWorker;
let connection: Redis;
let queue: Queue;
let events: QueueEvents;
const lines: string[] = [];

beforeAll(async () => {
  await resetTestDatabase();
  owner = poolFor('owner');
  app = poolFor('app');
  const env = testEnv();
  connection = new Redis(env.VALKEY_QUEUE_URL, { maxRetriesPerRequest: null });
  queue = new Queue(ALERTS_QUEUE, { connection });
  await queue.obliterate({ force: true });
  events = new QueueEvents(ALERTS_QUEUE, { connection: connection.duplicate() });
  const db = createDb(app);
  worker = await startAlertsWorker({
    queueUrl: env.VALKEY_QUEUE_URL,
    db,
    tokens: new AuthTokenService(db, { now: () => new Date() }),
    outbox: { send: () => Promise.resolve() },
    now: () => new Date(),
    log: (l) => lines.push(l),
  });
});

afterAll(async () => {
  await worker.close();
  await events.close();
  await queue.obliterate({ force: true });
  await queue.close();
  connection.disconnect();
  await app.end();
  await owner.end();
});

describe('alerts worker', () => {
  it('registers the Monday 06.00 WIB weekly summary schedule', async () => {
    const schedulers = await queue.getJobSchedulers();
    expect(schedulers).toEqual([
      expect.objectContaining({
        key: 'weekly',
        pattern: '0 6 * * 1',
        tz: 'Asia/Jakarta',
      }) as unknown,
    ]);
  });

  it('turns a queued evaluation into news, logging counts only', async () => {
    await loadObservations(owner, [
      ...weekdays('2026-09-01', '2026-09-29').map((d) => ({
        commodity: 'bawang-merah',
        date: d,
        price: 38_000,
      })),
      { commodity: 'bawang-merah', date: '2026-09-30', price: 40_300 },
    ]);
    const u = await owner.query<{ id: string }>(
      "INSERT INTO users (email, password_hash, email_verified_at) VALUES ('sari@contoh.id', $1, now()) RETURNING id",
      [HASH],
    );
    await owner.query(
      `INSERT INTO alert_watches (user_id, market_id, commodity_id, threshold_idr, direction, created_at)
       SELECT $1, m.id, c.id, 39000, 'above', '2026-09-30T08:00:00+07:00'
       FROM markets m, commodities c WHERE m.code = 'PIKJ' AND c.code = 'bawang-merah'`,
      [u.rows[0]?.id],
    );
    const job = await queue.add('evaluate', {});
    await job.waitUntilFinished(events, 20_000);
    const n = await owner.query('SELECT kind FROM notifications');
    expect(n.rows).toEqual([{ kind: 'price_threshold' }]);
    const logged = lines.join('\n');
    expect(logged).toContain('"msg":"alerts evaluated"');
    expect(logged).not.toContain('sari@contoh.id');
    expect(logged).not.toContain('Bawang merah');
  });
});
