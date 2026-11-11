import type pg from 'pg';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { poolFor, resetTestDatabase, sqlState } from '../helpers/test-db.js';

const INSUFFICIENT_PRIVILEGE = '42501';

let ingest: pg.Pool;
let app: pg.Pool;

beforeAll(async () => {
  await resetTestDatabase();
  ingest = poolFor('ingest');
  app = poolFor('app');
});

afterAll(async () => {
  await Promise.all([ingest.end(), app.end()]);
});

const insertObservation = `
  INSERT INTO price_observations (market_id, commodity_id, observed_on, price_idr, source)
  SELECT m.id, c.id, DATE '2026-09-30', 52400, 'seed_csv'
  FROM markets m, commodities c WHERE m.code = 'PIKJ' AND c.code = 'cabai-merah-keriting'`;

describe('ingest_w role', () => {
  it('can insert price observations', async () => {
    expect(await sqlState(ingest, insertObservation)).toBeNull();
  });

  it('can record ingest runs and refresh the latest-price view', async () => {
    expect(
      await sqlState(
        ingest,
        `INSERT INTO ingest_runs (source, status) VALUES ('seed_csv', 'running')`,
      ),
    ).toBeNull();
    expect(
      await sqlState(ingest, `UPDATE ingest_runs SET status = 'succeeded', finished_at = now()`),
    ).toBeNull();
    expect(await sqlState(ingest, 'SELECT refresh_latest_prices()')).toBeNull();
  });

  it('cannot modify or delete existing observations', async () => {
    expect(await sqlState(ingest, 'UPDATE price_observations SET price_idr = 1')).toBe(
      INSUFFICIENT_PRIVILEGE,
    );
    expect(await sqlState(ingest, 'DELETE FROM price_observations')).toBe(INSUFFICIENT_PRIVILEGE);
  });

  it('cannot read tables outside its job', async () => {
    expect(await sqlState(ingest, 'SELECT * FROM articles')).toBe(INSUFFICIENT_PRIVILEGE);
    expect(await sqlState(ingest, 'SELECT * FROM forecasts')).toBe(INSUFFICIENT_PRIVILEGE);
  });
});

describe('app_rw role', () => {
  it('can read observations and the latest-price view', async () => {
    expect(await sqlState(app, 'SELECT count(*) FROM price_observations')).toBeNull();
    expect(await sqlState(app, 'SELECT count(*) FROM mv_latest_prices')).toBeNull();
  });

  it('cannot trigger a refresh of the latest-price view (only ingest may)', async () => {
    expect(await sqlState(app, 'SELECT refresh_latest_prices()')).toBe(INSUFFICIENT_PRIVILEGE);
  });

  it('cannot run DDL or delete price history', async () => {
    expect(await sqlState(app, 'CREATE TABLE x ()')).toBe(INSUFFICIENT_PRIVILEGE);
    expect(await sqlState(app, 'DELETE FROM price_observations')).toBe(INSUFFICIENT_PRIVILEGE);
  });
});
