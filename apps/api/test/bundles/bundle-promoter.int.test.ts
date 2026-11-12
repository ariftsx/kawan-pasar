import type pg from 'pg';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { promoteBundle } from '../../src/bundles/bundle-promoter.js';
import { createDb } from '../../src/database/client.js';
import { fullRows, row, writeBundle } from '../helpers/bundles.js';
import { poolFor, resetTestDatabase } from '../helpers/test-db.js';

const now = new Date('2026-11-11T10:00:00+07:00');
const issued = '2026-11-10T07:00:00+07:00';

let app: pg.Pool;
let owner: pg.Pool;

beforeAll(async () => {
  await resetTestDatabase();
  app = poolFor('app');
  owner = poolFor('owner');
});

beforeEach(async () => {
  await owner.query('TRUNCATE forecasts, forecast_artifacts RESTART IDENTITY CASCADE');
});

afterAll(async () => {
  await Promise.all([app.end(), owner.end()]);
});

async function statuses(): Promise<Record<string, string>> {
  const res = await owner.query<{ bundle_id: string; status: string }>(
    'SELECT bundle_id, status FROM forecast_artifacts ORDER BY id',
  );
  return Object.fromEntries(res.rows.map((r) => [r.bundle_id, r.status]));
}

describe('promoteBundle (as app_rw)', () => {
  it('activates a clean bundle with all its rows', async () => {
    const rows = [...fullRows('cabai-merah-keriting'), ...fullRows('bawang-merah', 38_900)];
    const result = await promoteBundle(
      createDb(app),
      await writeBundle({ bundleId: 'a-1', issuedAt: issued, rows }),
      now,
    );
    expect(result).toMatchObject({ status: 'active', bundleId: 'a-1' });
    expect(await statuses()).toEqual({ 'a-1': 'active' });
    const count = await owner.query<{ n: number }>('SELECT count(*)::int AS n FROM forecasts');
    expect(count.rows[0]?.n).toBe(16);
  });

  it('retires the previous active bundle of the same model', async () => {
    await promoteBundle(
      createDb(app),
      await writeBundle({ bundleId: 'a-1', issuedAt: issued, rows: fullRows() }),
      now,
    );
    await promoteBundle(
      createDb(app),
      await writeBundle({ bundleId: 'a-2', issuedAt: issued, rows: fullRows() }),
      now,
    );
    expect(await statuses()).toEqual({ 'a-1': 'retired', 'a-2': 'active' });
  });

  it('records a broken bundle as rejected and keeps the active one', async () => {
    await promoteBundle(
      createDb(app),
      await writeBundle({ bundleId: 'a-1', issuedAt: issued, rows: fullRows() }),
      now,
    );
    const result = await promoteBundle(
      createDb(app),
      await writeBundle({ bundleId: 'a-bad', issuedAt: issued, rows: [row({ horizon_days: 2 })] }),
      now,
    );
    expect(result.status).toBe('rejected');
    expect(result.reasons).toContain('schema');
    expect(await statuses()).toEqual({ 'a-1': 'active', 'a-bad': 'rejected' });
  });

  it('marks demo bundles and keeps them active next to a real model', async () => {
    await promoteBundle(
      createDb(app),
      await writeBundle({
        bundleId: 'demo-1',
        issuedAt: issued,
        rows: fullRows(),
        modelName: 'demo',
      }),
      now,
    );
    await promoteBundle(
      createDb(app),
      await writeBundle({ bundleId: 'real-1', issuedAt: issued, rows: fullRows() }),
      now,
    );
    const res = await owner.query<{ bundle_id: string; is_demo: boolean; status: string }>(
      'SELECT bundle_id, is_demo, status FROM forecast_artifacts ORDER BY id',
    );
    expect(res.rows).toEqual([
      { bundle_id: 'demo-1', is_demo: true, status: 'active' },
      { bundle_id: 'real-1', is_demo: false, status: 'active' },
    ]);
  });

  it('refuses to promote the same bundle id twice', async () => {
    const dir = await writeBundle({ bundleId: 'a-1', issuedAt: issued, rows: fullRows() });
    await promoteBundle(createDb(app), dir, now);
    const again = await promoteBundle(createDb(app), dir, now);
    expect(again.status).toBe('rejected');
    expect(again.reasons).toContain('already_known');
    expect(await statuses()).toEqual({ 'a-1': 'active' });
  });
});

describe('promoteBundle ordering', () => {
  it('refuses a bundle older than the active bundle of the same model', async () => {
    await owner.query('TRUNCATE forecasts, forecast_artifacts RESTART IDENTITY CASCADE');
    await promoteBundle(
      createDb(app),
      await writeBundle({
        bundleId: 'new-1',
        issuedAt: '2026-11-10T07:00:00+07:00',
        rows: fullRows(),
      }),
      now,
    );
    const old = await promoteBundle(
      createDb(app),
      await writeBundle({
        bundleId: 'old-1',
        issuedAt: '2026-11-03T07:00:00+07:00',
        rows: fullRows(),
      }),
      now,
    );
    expect(old.status).toBe('rejected');
    expect(old.reasons).toContain('superseded');
    expect(await statuses()).toEqual({ 'new-1': 'active', 'old-1': 'rejected' });
  });
});
