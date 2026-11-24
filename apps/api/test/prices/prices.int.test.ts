import {
  HistoryResponseSchema,
  MarketsResponseSchema,
  PriceSummaryResponseSchema,
} from '@kawan-pasar/contracts';
import type { NestFastifyApplication } from '@nestjs/platform-fastify';
import { Redis } from 'ioredis';
import pg from 'pg';
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { loadObservations, weekdays } from '../helpers/fixtures.js';
import { fixedClock, serviceToken, startApp } from '../helpers/test-app.js';
import { poolFor, resetTestDatabase } from '../helpers/test-db.js';

const bawangDays = weekdays('2026-08-03', '2026-09-30');
const fixture = [
  { commodity: 'cabai-merah-keriting', date: '2026-08-29', price: 48_900 },
  { commodity: 'cabai-merah-keriting', date: '2026-09-23', price: 50_780 },
  { commodity: 'cabai-merah-keriting', date: '2026-09-30', price: 52_400 },
  ...bawangDays.map((date, i) => ({ commodity: 'bawang-merah', date, price: 38_000 + i * 10 })),
  { commodity: 'beras-medium-1', date: '2026-11-10', price: 13_650 },
];

let app: NestFastifyApplication;
let owner: pg.Pool;
const redis = new Redis(process.env['VALKEY_CACHE_URL'] ?? '');

const get = (url: string) =>
  app.inject({ method: 'GET', url, headers: { 'x-service-token': serviceToken() } });

beforeAll(async () => {
  await resetTestDatabase();
  owner = poolFor('owner');
  await loadObservations(owner, fixture);
  app = await startApp({ clock: fixedClock('2026-11-11T10:00:00+07:00') });
});

beforeEach(async () => {
  const keys = [
    ...(await redis.keys('kp:v1:prices:*')),
    ...(await redis.keys('kp:v1:json:prices:*')),
    // The coverage snapshot (Fase 4C) lives in the forecasts scope and follows the active bundle.
    ...(await redis.keys('kp:v1:forecasts:*')),
  ];
  if (keys.length > 0) await redis.del(...keys);
});

afterAll(async () => {
  await app.close();
  await owner.end();
  redis.disconnect();
});

describe('GET /v1/markets', () => {
  it('lists the catalog markets with their availability', async () => {
    const body = MarketsResponseSchema.parse((await get('/v1/markets')).json());
    expect(body.items.map((m) => [m.code, m.status])).toEqual([
      ['PIKJ', 'available'],
      ['PSEN', 'coming_soon'],
      ['PITT', 'coming_soon'],
      ['PBKS', 'coming_soon'],
    ]);
  });
});

describe('GET /v1/markets/:market/prices', () => {
  it('summarises the five commodities in catalog order', async () => {
    const res = await get('/v1/markets/PIKJ/prices');
    expect(res.statusCode).toBe(200);
    const body = PriceSummaryResponseSchema.parse(res.json());
    expect(body.items.map((i) => i.code)).toEqual([
      'cabai-merah-keriting',
      'bawang-merah',
      'beras-medium-1',
      'cabai-rawit-hijau',
      'cabai-rawit-merah',
    ]);
    expect(body.latestObservedOn).toBe('2026-11-10');
  });

  it('computes changes from the 7- and 30-day reference prices and flags stale data', async () => {
    const body = PriceSummaryResponseSchema.parse((await get('/v1/markets/PIKJ/prices')).json());
    const cabai = body.items[0];
    expect(cabai?.latest).toEqual({ observedOn: '2026-09-30', priceIdr: 52_400 });
    expect(cabai?.change7d).toBe(0.0319); // (52400-50780)/50780
    expect(cabai?.change30d).toBe(0.0716); // (52400-48900)/48900
    expect(cabai?.dataStatus).toBe('stale');
    expect(body.items[2]?.dataStatus).toBe('fresh'); // beras observed yesterday
  });

  it('caps the sparkline at the last 30 observations in ascending order', async () => {
    const body = PriceSummaryResponseSchema.parse((await get('/v1/markets/PIKJ/prices')).json());
    const spark = body.items[1]?.sparkline ?? [];
    expect(spark).toHaveLength(30);
    expect(spark.at(-1)?.observedOn).toBe('2026-09-30');
    expect([...spark].sort((a, b) => a.observedOn.localeCompare(b.observedOn))).toEqual(spark);
  });

  it('reports commodities without data as unknown, never as zero', async () => {
    const body = PriceSummaryResponseSchema.parse((await get('/v1/markets/PIKJ/prices')).json());
    expect(body.items[3]).toMatchObject({
      code: 'cabai-rawit-hijau',
      latest: null,
      change7d: null,
      change30d: null,
      dataStatus: 'no_data',
      sparkline: [],
      forecast7d: { status: 'pending_coverage', q50Change: null, direction: null },
    });
  });

  it('answers a coming-soon market with its status and no items', async () => {
    const body = PriceSummaryResponseSchema.parse((await get('/v1/markets/PSEN/prices')).json());
    expect(body.market.status).toBe('coming_soon');
    expect(body.items).toEqual([]);
    expect(body.latestObservedOn).toBeNull();
  });

  it('answers an unknown market with 404', async () => {
    expect((await get('/v1/markets/XXXX/prices')).statusCode).toBe(404);
    expect((await get('/v1/markets/pikj/prices')).statusCode).toBe(404);
  });

  it('has no forecast artifact while no bundle is active', async () => {
    const body = PriceSummaryResponseSchema.parse((await get('/v1/markets/PIKJ/prices')).json());
    expect(body.forecastArtifact).toBeNull();
  });

  it('uses at most 2 queries on a cache miss and none on a hit', async () => {
    const spy = vi.spyOn(pg.Client.prototype, 'query');
    try {
      await get('/v1/markets/PIKJ/prices');
      expect(spy.mock.calls.length).toBeLessThanOrEqual(2);
      spy.mockClear();
      await get('/v1/markets/PIKJ/prices');
      expect(spy.mock.calls.length).toBe(0);
    } finally {
      spy.mockRestore();
    }
  });
});

describe('GET /v1/markets/:market/commodities/:commodity/history', () => {
  it('returns the window before the latest observation for 30d', async () => {
    const body = HistoryResponseSchema.parse(
      (await get('/v1/markets/PIKJ/commodities/bawang-merah/history?range=30d')).json(),
    );
    expect(body.points.map((p) => p.observedOn)).toEqual(
      bawangDays.filter((d) => d > '2026-08-31'),
    );
    expect(body.downsampled).toBe(false);
  });

  it('defaults to 90 days', async () => {
    const body = HistoryResponseSchema.parse(
      (await get('/v1/markets/PIKJ/commodities/bawang-merah/history')).json(),
    );
    expect(body.range).toBe('90d');
    expect(body.points).toHaveLength(bawangDays.length);
  });

  it('downsamples "all" to at most one point per week', async () => {
    const body = HistoryResponseSchema.parse(
      (await get('/v1/markets/PIKJ/commodities/bawang-merah/history?range=all')).json(),
    );
    expect(body.downsampled).toBe(true);
    const weeks = body.points.map((p) => {
      const d = new Date(`${p.observedOn}T00:00:00Z`);
      d.setUTCDate(d.getUTCDate() - ((d.getUTCDay() + 6) % 7));
      return d.toISOString().slice(0, 10);
    });
    expect(new Set(weeks).size).toBe(weeks.length);
    expect(body.points.at(-1)?.observedOn).toBe('2026-09-30');
  });

  it('returns no points for a commodity without data', async () => {
    const body = HistoryResponseSchema.parse(
      (await get('/v1/markets/PIKJ/commodities/cabai-rawit-merah/history?range=30d')).json(),
    );
    expect(body.points).toEqual([]);
  });

  it('rejects an unknown range by field name', async () => {
    const res = await get('/v1/markets/PIKJ/commodities/bawang-merah/history?range=7d');
    expect(res.statusCode).toBe(400);
    expect(res.json()).toMatchObject({ error: { fields: ['range'] } });
  });

  it('answers an unknown commodity with 404', async () => {
    expect((await get('/v1/markets/PIKJ/commodities/durian/history')).statusCode).toBe(404);
  });
});

describe('summary forecast status against the active bundle', () => {
  // Fase 4C K1: a commodity missing from the active bundle is "menyusul" (pending).
  it('reports a commodity missing from the active bundle as pending', async () => {
    const { promoteBundle } = await import('../../src/bundles/bundle-promoter.js');
    const { createDb } = await import('../../src/database/client.js');
    const { fullRows, writeBundle } = await import('../helpers/bundles.js');
    const appPool = poolFor('app');
    try {
      await promoteBundle(
        createDb(appPool),
        await writeBundle({
          bundleId: 'summary-only-cabai',
          issuedAt: '2026-11-10T07:00:00+07:00',
          rows: fullRows('cabai-merah-keriting'),
        }),
        new Date('2026-11-11T10:00:00+07:00'),
      );
    } finally {
      await appPool.end();
    }
    const body = PriceSummaryResponseSchema.parse((await get('/v1/markets/PIKJ/prices')).json());
    expect(body.items[0]?.forecast7d.status).toBe('available');
    expect(body.items[2]?.forecast7d).toEqual({
      status: 'pending_coverage',
      q50Change: null,
      direction: null,
    });
    expect(body.items[2]?.modelCoverage).toBe('pending');
    // Every forecast shown in the summary carries its model metadata (design anti-goal).
    expect(body.forecastArtifact?.modelVersion).toBeTruthy();
    expect(body.forecastArtifact?.dataVersion).toBeTruthy();
    expect(body.forecastArtifact).toMatchObject({ isDemo: false, ageDays: 1 });
    const ttl = await redis.ttl('kp:v1:json:prices:summary:PIKJ');
    expect(ttl).toBeGreaterThan(0);
    expect(ttl).toBeLessThanOrEqual(3600);
  });
});
