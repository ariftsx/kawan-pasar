import type pg from 'pg';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { createDb } from '../../src/database/client.js';
import { seedCatalog } from '../../src/database/seed/catalog.seed.js';
import { poolFor, resetTestDatabase, sqlState } from '../helpers/test-db.js';

const UNIQUE_VIOLATION = '23505';
const CHECK_VIOLATION = '23514';

let owner: pg.Pool;

async function idOf(table: 'markets' | 'commodities', code: string): Promise<number> {
  const res = await owner.query<{ id: number }>(`SELECT id FROM ${table} WHERE code = $1`, [code]);
  const row = res.rows[0];
  if (row === undefined) throw new Error(`${table} ${code} not seeded`);
  return row.id;
}

async function insertObservation(
  commodity: string,
  date: string,
  price: number,
): Promise<string | null> {
  return sqlState(
    owner,
    `INSERT INTO price_observations (market_id, commodity_id, observed_on, price_idr, source)
     VALUES ($1, $2, $3, $4, 'seed_csv')`,
    [await idOf('markets', 'PIKJ'), await idOf('commodities', commodity), date, price],
  );
}

async function insertArtifact(bundleId: string, status: string): Promise<string | null> {
  return sqlState(
    owner,
    `INSERT INTO forecast_artifacts (bundle_id, model_name, model_version, data_version,
       preprocess_version, data_cutoff, issued_at, checksum_sha256, status)
     VALUES ($1, 'arif-net', 'v1', 'd1', 'p1', now(), now(), repeat('a', 64), $2)`,
    [bundleId, status],
  );
}

async function insertForecast(
  horizon: number,
  q10: number | null,
  q50: number | null,
  q90: number | null,
): Promise<string | null> {
  const artifact = await owner.query<{ id: number }>(
    `SELECT id FROM forecast_artifacts WHERE bundle_id = 'fc-base'`,
  );
  return sqlState(
    owner,
    `INSERT INTO forecasts (artifact_id, market_id, commodity_id, base_date, horizon_days,
       q10_change, q50_change, q90_change, eval_status)
     VALUES ($1, $2, $3, '2026-09-30', $4, $5, $6, $7, 'available')`,
    [
      artifact.rows[0]?.id,
      await idOf('markets', 'PIKJ'),
      await idOf('commodities', 'cabai-merah-keriting'),
      horizon,
      q10,
      q50,
      q90,
    ],
  );
}

beforeAll(async () => {
  await resetTestDatabase();
  owner = poolFor('owner');
});

afterAll(async () => {
  await owner.end();
});

beforeEach(async () => {
  await owner.query(
    'TRUNCATE price_observations, forecasts, forecast_artifacts RESTART IDENTITY CASCADE',
  );
});

describe('price_observations constraints', () => {
  it('rejects a second observation for the same market, commodity and date', async () => {
    expect(await insertObservation('cabai-merah-keriting', '2026-09-30', 52_400)).toBeNull();
    expect(await insertObservation('cabai-merah-keriting', '2026-09-30', 53_000)).toBe(
      UNIQUE_VIOLATION,
    );
  });

  it('rejects a zero price so unknown values can never be stored as 0', async () => {
    expect(await insertObservation('bawang-merah', '2026-09-30', 0)).toBe(CHECK_VIOLATION);
  });
});

describe('forecast constraints', () => {
  beforeEach(async () => {
    expect(await insertArtifact('fc-base', 'pending')).toBeNull();
  });

  it('rejects a horizon outside the eight product horizons', async () => {
    expect(await insertForecast(2, -0.01, 0, 0.01)).toBe(CHECK_VIOLATION);
  });

  it('rejects quantiles that are not monotonic', async () => {
    expect(await insertForecast(7, 0.05, 0.02, 0.08)).toBe(CHECK_VIOLATION);
  });

  it('accepts a forecast whose quantiles are all unknown', async () => {
    expect(await insertForecast(180, null, null, null)).toBeNull();
  });
});

describe('forecast_artifacts constraints', () => {
  it('allows only one active bundle per model', async () => {
    expect(await insertArtifact('a-1', 'active')).toBeNull();
    expect(await insertArtifact('a-2', 'active')).toBe(UNIQUE_VIOLATION);
    expect(await insertArtifact('a-3', 'retired')).toBeNull();
  });
});

describe('catalog seed', () => {
  it('is idempotent', async () => {
    await seedCatalog(createDb(owner));
    await seedCatalog(createDb(owner));
    const counts = await owner.query<{ c: number; m: number }>(
      'SELECT (SELECT count(*)::int FROM commodities) AS c, (SELECT count(*)::int FROM markets) AS m',
    );
    expect(counts.rows[0]).toEqual({ c: 5, m: 4 });
  });
});

describe('mv_latest_prices', () => {
  it('holds the latest price and the prices 7 and 30 calendar days before it', async () => {
    await insertObservation('cabai-merah-keriting', '2026-09-30', 52_400);
    await insertObservation('cabai-merah-keriting', '2026-09-23', 50_780);
    await insertObservation('cabai-merah-keriting', '2026-08-29', 48_900);
    await insertObservation('bawang-merah', '2026-09-30', 38_900);
    await owner.query('SELECT refresh_latest_prices()');

    const rows = await owner.query<{
      code: string;
      observed_on: string;
      price_idr: number;
      price_7d_idr: number | null;
      price_30d_idr: number | null;
    }>(
      `SELECT c.code, to_char(v.observed_on, 'YYYY-MM-DD') AS observed_on,
              v.price_idr, v.price_7d_idr, v.price_30d_idr
       FROM mv_latest_prices v JOIN commodities c ON c.id = v.commodity_id
       ORDER BY c.sort_order`,
    );
    expect(rows.rows).toEqual([
      {
        code: 'cabai-merah-keriting',
        observed_on: '2026-09-30',
        price_idr: 52_400,
        price_7d_idr: 50_780,
        price_30d_idr: 48_900,
      },
      {
        code: 'bawang-merah',
        observed_on: '2026-09-30',
        price_idr: 38_900,
        price_7d_idr: null,
        price_30d_idr: null,
      },
    ]);
  });
});

describe('observation bounds (Fase 0 review M9)', () => {
  it('rejects prices above the plausible maximum', async () => {
    expect(await insertObservation('cabai-merah-keriting', '2026-09-30', 10_000_001)).toBe(
      CHECK_VIOLATION,
    );
  });

  it('rejects observations before 2000-01-01', async () => {
    expect(await insertObservation('cabai-merah-keriting', '1999-12-31', 40_000)).toBe(
      CHECK_VIOLATION,
    );
  });
});

describe('catalog seed with a commodity no longer in the catalog (Fase 0 review M8)', () => {
  it('does not grow sort_order of rows outside the catalog on repeated seeds', async () => {
    await owner.query(
      "INSERT INTO commodities (code, name, unit, model_coverage, sort_order) VALUES ('test-removed', 'X', 'kg', 'pending', 9)",
    );
    try {
      for (let i = 0; i < 40; i += 1) await seedCatalog(createDb(owner));
      const res = await owner.query<{ sort_order: number }>(
        "SELECT sort_order FROM commodities WHERE code = 'test-removed'",
      );
      expect(res.rows[0]?.sort_order).toBe(9);
    } finally {
      await owner.query("DELETE FROM commodities WHERE code = 'test-removed'");
    }
  });
});
