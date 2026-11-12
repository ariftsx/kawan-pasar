import { ForecastResponseSchema } from '@kawan-pasar/contracts';
import type { NestFastifyApplication } from '@nestjs/platform-fastify';
import { Redis } from 'ioredis';
import type pg from 'pg';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { promoteBundle } from '../../src/bundles/bundle-promoter.js';
import { createDb } from '../../src/database/client.js';
import { fullRows, writeBundle } from '../helpers/bundles.js';
import { loadObservations } from '../helpers/fixtures.js';
import { fixedClock, serviceToken, startApp } from '../helpers/test-app.js';
import { poolFor, resetTestDatabase } from '../helpers/test-db.js';

const clock = fixedClock('2026-11-11T10:00:00+07:00');
let app: NestFastifyApplication;
let owner: pg.Pool;
let appPool: pg.Pool;
const redis = new Redis(process.env['VALKEY_CACHE_URL'] ?? '');

const get = async (commodity: string) => {
  const res = await app.inject({
    method: 'GET',
    url: `/v1/markets/PIKJ/commodities/${commodity}/forecast`,
    headers: { 'x-service-token': serviceToken() },
  });
  return { status: res.statusCode, body: ForecastResponseSchema.parse(res.json()) };
};

beforeAll(async () => {
  await resetTestDatabase();
  owner = poolFor('owner');
  appPool = poolFor('app');
  await loadObservations(owner, [
    { commodity: 'cabai-merah-keriting', date: '2026-09-30', price: 52_400 },
  ]);
  await promoteBundle(
    createDb(appPool),
    await writeBundle({
      bundleId: 'demo-x',
      issuedAt: '2026-11-09T07:00:00+07:00',
      rows: fullRows(),
      modelName: 'demo',
    }),
    clock.now(),
  );
  app = await startApp({ clock });
});

beforeEach(async () => {
  clock.set('2026-11-11T10:00:00+07:00');
  const keys = [
    ...(await redis.keys('kp:v1:forecasts:*')),
    ...(await redis.keys('kp:v1:json:forecasts:*')),
  ];
  if (keys.length > 0) await redis.del(...keys);
});

afterAll(async () => {
  await app.close();
  await Promise.all([owner.end(), appPool.end()]);
  redis.disconnect();
});

describe('GET …/forecast', () => {
  it('returns eight ascending horizons with full version metadata', async () => {
    const { status, body } = await get('cabai-merah-keriting');
    expect(status).toBe(200);
    expect(body.status).toBe('available');
    expect(body.horizons.map((h) => h.horizonDays)).toEqual([1, 3, 7, 14, 30, 90, 180, 365]);
    expect(body.artifact).toMatchObject({
      modelName: 'demo',
      modelVersion: 'v1.0.0',
      dataVersion: 'pihps-2026-09-30',
      preprocessVersion: 'p1',
      isDemo: true,
      ageDays: 2,
    });
    expect(body.baseDate).toBe('2026-09-30');
    expect(body.basePriceIdr).toBe(52_400);
    expect(body.horizons[2]).toMatchObject({ horizonDays: 7, targetDate: '2026-10-07' });
    expect(body.horizons[7]?.evalStatus).toBe('not_tested');
  });

  it('keeps the numbers but marks the forecast expired after 8 days', async () => {
    clock.set('2026-11-19T10:00:00+07:00');
    const { body } = await get('cabai-merah-keriting');
    expect(body.status).toBe('expired');
    expect(body.horizons).toHaveLength(8);
  });

  it('hides all numbers after 28 days but still reports the bundle version', async () => {
    clock.set('2026-12-09T10:00:00+07:00');
    const { body } = await get('cabai-merah-keriting');
    expect(body.status).toBe('hidden');
    expect(body.horizons).toEqual([]);
    expect(body.baseDate).toBeNull();
    expect(body.basePriceIdr).toBeNull();
    expect(body.artifact?.modelVersion).toBe('v1.0.0');
  });

  it('reports commodities outside the model as pending_coverage', async () => {
    const { body } = await get('cabai-rawit-merah');
    expect(body).toMatchObject({ status: 'pending_coverage', artifact: null, horizons: [] });
  });

  it('reports unavailable for a covered commodity missing from the bundle', async () => {
    const { body } = await get('beras-medium-1');
    expect(body.status).toBe('unavailable');
    expect(body.horizons).toEqual([]);
  });

  it('answers an unknown commodity with 404', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/v1/markets/PIKJ/commodities/durian/forecast',
      headers: { 'x-service-token': serviceToken() },
    });
    expect(res.statusCode).toBe(404);
  });
});
