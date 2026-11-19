import type pg from 'pg';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { promoteBundle } from '../../src/bundles/bundle-promoter.js';
import { createDb } from '../../src/database/client.js';
import { evaluateAlerts } from '../../src/modules/alerts/evaluator.js';
import { fullRows, row, writeBundle } from '../helpers/bundles.js';
import { loadObservations, weekdays } from '../helpers/fixtures.js';
import { poolFor, resetTestDatabase } from '../helpers/test-db.js';

const HASH =
  '$argon2id$v=19$m=19456,t=2,p=1$c2FsdHNhbHRzYWx0$aGFzaGhhc2hoYXNoaGFzaGhhc2hoYXNoaGFzaA';
const DATA_DAY = '2026-09-30';

let owner: pg.Pool;
let app: pg.Pool;

/** Bawang merah: two quiet years (±0,5 %), then +6,6 % on the last day (37.800 → 40.300). */
async function loadBawang(): Promise<void> {
  const days = weekdays('2024-09-02', '2026-09-29');
  await loadObservations(owner, [
    ...days.map((d, i) => ({
      commodity: 'bawang-merah',
      date: d,
      price: i % 2 === 0 ? 37_800 : 38_000,
    })),
    { commodity: 'bawang-merah', date: DATA_DAY, price: 40_300 },
  ]);
}

async function user(email: string, verified = true): Promise<string> {
  const r = await owner.query<{ id: string }>(
    'INSERT INTO users (email, password_hash, email_verified_at) VALUES ($1, $2, $3) RETURNING id',
    [email, HASH, verified ? new Date() : null],
  );
  return r.rows[0]?.id ?? '';
}

async function watch(
  userId: string,
  opts: { threshold?: [number, 'above' | 'below']; createdAt?: string; commodity?: string } = {},
): Promise<void> {
  await owner.query(
    `INSERT INTO alert_watches (user_id, market_id, commodity_id, threshold_idr, direction, created_at)
     SELECT $1, m.id, c.id, $3, $4, $5::timestamptz
     FROM markets m, commodities c WHERE m.code = 'PIKJ' AND c.code = $2`,
    [
      userId,
      opts.commodity ?? 'bawang-merah',
      opts.threshold?.[0] ?? null,
      opts.threshold?.[1] ?? null,
      opts.createdAt ?? '2026-09-30T08:00:00+07:00',
    ],
  );
}

async function news(userId?: string): Promise<
  {
    kind: string;
    title: string;
    body: string;
    link: string | null;
    model_version: string | null;
    data_date: string;
  }[]
> {
  const r = await owner.query(
    `SELECT kind, title, body, link, model_version, to_char(data_date, 'YYYY-MM-DD') AS data_date
     FROM notifications ${userId === undefined ? '' : 'WHERE user_id = $1'} ORDER BY kind`,
    userId === undefined ? [] : [userId],
  );
  return r.rows as never;
}

beforeAll(async () => {
  await resetTestDatabase();
  owner = poolFor('owner');
  app = poolFor('app');
  await loadBawang();
});

beforeEach(async () => {
  await owner.query('DELETE FROM users'); // cascades to watches, preferences, notifications
  await owner.query('TRUNCATE forecasts, forecast_artifacts RESTART IDENTITY CASCADE');
});

afterAll(async () => {
  await app.end();
  await owner.end();
});

describe('evaluateAlerts (as app_rw, the worker role)', () => {
  it('writes the unusual move and the crossed own limit, in plain words', async () => {
    const id = await user('sari@contoh.id');
    await watch(id, { threshold: [39_000, 'above'] });
    expect(await evaluateAlerts(createDb(app))).toEqual({ watches: 1, created: 2 });
    const rows = await news(id);
    expect(rows.map((r) => r.kind)).toEqual(['unusual_move', 'price_threshold']);
    expect(rows[0]).toMatchObject({
      title: expect.stringMatching(/^Bawang merah naik 6,\d% dalam 7 hari$/) as unknown,
      link: '/harga/bawang-merah',
      data_date: DATA_DAY,
    });
    expect(rows[1]).toMatchObject({
      title: 'Bawang merah di atas batas Anda (Rp 39.000/kg)',
      body: 'Rp 40.300/kg di Pasar Kramat Jati pada 30 Sep 2026, sebelumnya Rp 38.000/kg.',
    });
  });

  it('is idempotent: a second evaluation of the same data adds nothing', async () => {
    const id = await user('sari@contoh.id');
    await watch(id, { threshold: [39_000, 'above'] });
    await evaluateAlerts(createDb(app));
    expect((await evaluateAlerts(createDb(app))).created).toBe(0);
    expect(await news(id)).toHaveLength(2);
  });

  it('sends nothing to unverified accounts or with in-app news switched off', async () => {
    const unverified = await user('baru@contoh.id', false);
    await watch(unverified, { threshold: [39_000, 'above'] });
    const off = await user('diam@contoh.id');
    await watch(off, { threshold: [39_000, 'above'] });
    await owner.query('INSERT INTO alert_preferences (user_id, in_app) VALUES ($1, false)', [off]);
    expect(await evaluateAlerts(createDb(app))).toEqual({ watches: 0, created: 0 });
  });

  it('respects each rule switch', async () => {
    const id = await user('sari@contoh.id');
    await watch(id, { threshold: [39_000, 'above'] });
    await owner.query(
      'INSERT INTO alert_preferences (user_id, unusual_move, price_threshold) VALUES ($1, false, true)',
      [id],
    );
    await evaluateAlerts(createDb(app));
    expect((await news(id)).map((r) => r.kind)).toEqual(['price_threshold']);
  });

  it('a watch made after the data does not report that older data', async () => {
    const id = await user('sari@contoh.id');
    await watch(id, { threshold: [39_000, 'above'], createdAt: '2026-11-19T08:00:00+07:00' });
    expect((await evaluateAlerts(createDb(app))).created).toBe(0);
  });

  it('a forecast rise comes only from a real (non-demo) bundle issued after the watch', async () => {
    const id = await user('sari@contoh.id');
    await watch(id);
    await owner.query('INSERT INTO alert_preferences (user_id, unusual_move) VALUES ($1, false)', [
      id,
    ]);
    const rising = fullRows('bawang-merah', 40_300).map((r, i) =>
      i === 2
        ? row({
            commodity_code: 'bawang-merah',
            horizon_days: 7,
            q10_change: -0.01,
            q50_change: 0.031,
            q90_change: 0.08,
            q10_price_idr: 39_897,
            q50_price_idr: 41_549,
            q90_price_idr: 43_524,
          })
        : r,
    );
    const now = new Date('2026-10-01T03:00:00Z');
    await promoteBundle(
      createDb(app),
      await writeBundle({
        bundleId: 'demo-1',
        modelName: 'demo',
        issuedAt: now.toISOString(),
        rows: rising,
      }),
      now,
    );
    expect((await evaluateAlerts(createDb(app))).created).toBe(0);

    await promoteBundle(
      createDb(app),
      await writeBundle({ bundleId: 'arif-1', issuedAt: now.toISOString(), rows: rising }),
      now,
    );
    await evaluateAlerts(createDb(app));
    const [n] = await news(id);
    expect(n).toMatchObject({
      kind: 'forecast_rise',
      title: 'Prediksi: bawang merah naik 3,1% dalam 7 hari',
      model_version: 'v1.0.0',
      link: '/prediksi/bawang-merah',
    });
    expect(n?.body).toContain('Rp 41.549/kg (rentang Rp 39.897–Rp 43.524)');
  });

  it('uses the same number of queries for 1 and for 300 watches (no N+1)', async () => {
    const counted = (): { pool: pg.Pool; count: () => number } => {
      let n = 0;
      const query = app.query.bind(app) as (...a: unknown[]) => unknown;
      const proxy = new Proxy(app, {
        get(target, prop, receiver) {
          if (prop === 'query') {
            return (...args: unknown[]) => {
              n += 1;
              return query(...args);
            };
          }
          return Reflect.get(target, prop, receiver) as unknown;
        },
      });
      return { pool: proxy, count: () => n };
    };
    await watch(await user('satu@contoh.id'), { threshold: [39_000, 'above'] });
    const one = counted();
    await evaluateAlerts(createDb(one.pool));

    await owner.query('DELETE FROM users');
    await owner.query(
      `WITH u AS (
         INSERT INTO users (email, password_hash, email_verified_at)
         SELECT 'u' || g || '@contoh.id', $1, now() FROM generate_series(1, 300) g RETURNING id)
       INSERT INTO alert_watches (user_id, market_id, commodity_id, threshold_idr, direction, created_at)
       SELECT u.id, m.id, c.id, 39000, 'above', '2026-09-30T08:00:00+07:00'
       FROM u, markets m, commodities c WHERE m.code = 'PIKJ' AND c.code = 'bawang-merah'`,
      [HASH],
    );
    const many = counted();
    const result = await evaluateAlerts(createDb(many.pool));
    expect(result).toEqual({ watches: 300, created: 600 });
    // 3 reads + 1 batched insert per 500 rows (600 rows → 2 inserts).
    expect(one.count()).toBe(4);
    expect(many.count()).toBe(5);
  });
});
