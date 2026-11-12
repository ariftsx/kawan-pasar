import { mkdtemp } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import type { CommodityCode } from '@kawan-pasar/catalog';
import type { PricePoint } from '@kawan-pasar/contracts';
import { describe, expect, it } from 'vitest';
import { readBundle } from '../../src/bundles/bundle-reader.js';
import { writeBundleDir } from '../../src/bundles/bundle-writer.js';
import { verifyBundle } from '../../src/bundles/bundle-verifier.js';
import { generateDemoBundle } from '../../src/bundles/demo-generator.js';
import { weekdays } from '../helpers/fixtures.js';

const now = new Date('2026-11-11T03:00:00Z');
const days = weekdays('2024-09-02', '2026-09-30');

const series = (price: (i: number) => number): PricePoint[] =>
  days.map((observedOn, i) => ({ observedOn, priceIdr: Math.round(price(i)) }));

const generate = (input: Partial<Record<CommodityCode, PricePoint[]>>) =>
  generateDemoBundle(new Map(Object.entries(input) as [CommodityCode, PricePoint[]][]), {
    marketCode: 'PIKJ',
    now,
  });

describe('generateDemoBundle', () => {
  it('produces zero change for a constant series', () => {
    const { rows } = generate({ 'beras-medium-1': series(() => 16_100) });
    expect(rows).toHaveLength(8);
    for (const r of rows) {
      expect([r.q10_change, r.q50_change, r.q90_change]).toEqual([0, 0, 0]);
      expect([r.q10_price_idr, r.q50_price_idr, r.q90_price_idr]).toEqual([16_100, 16_100, 16_100]);
    }
  });

  it('produces a positive, monotonic forecast for a rising series', () => {
    const { rows } = generate({ 'cabai-merah-keriting': series((i) => 40_000 * 1.001 ** i) });
    const h7 = rows.find((r) => r.horizon_days === 7);
    expect(h7?.q50_change).toBeGreaterThan(0);
    for (const r of rows) {
      expect(r.q10_change ?? 0).toBeLessThanOrEqual(r.q50_change ?? 0);
      expect(r.q50_change ?? 0).toBeLessThanOrEqual(r.q90_change ?? 0);
      expect(r.q10_price_idr ?? 0).toBeLessThanOrEqual(r.q50_price_idr ?? 0);
    }
  });

  it('only covers commodities inside the model coverage, with eight horizons each', () => {
    const { rows } = generate({
      'bawang-merah': series(() => 38_900),
      'cabai-rawit-hijau': series(() => 45_200),
    });
    expect(new Set(rows.map((r) => r.commodity_code))).toEqual(new Set(['bawang-merah']));
    expect(rows.map((r) => r.horizon_days)).toEqual([1, 3, 7, 14, 30, 90, 180, 365]);
  });

  it('labels the evaluation status by horizon', () => {
    const { rows } = generate({ 'bawang-merah': series(() => 38_900) });
    expect(rows.map((r) => r.eval_status)).toEqual([
      'available',
      'available',
      'available',
      'available',
      'available',
      'partial',
      'not_tested',
      'not_tested',
    ]);
  });

  it('describes itself as a demo with full version metadata and a stable id', () => {
    const a = generate({ 'bawang-merah': series(() => 38_900) });
    const b = generate({ 'bawang-merah': series(() => 38_900) });
    expect(a.metadata).toMatchObject({
      model_name: 'demo',
      model_version: 'demo-empirical-quantile-v1',
      data_version: 'seed-csv-2026-09-30',
      preprocess_version: 'none',
      data_cutoff: '2026-09-30T23:59:59+07:00',
    });
    expect(a.metadata.bundle_id).toMatch(/^demo-2026-09-30-\d{12}-[0-9a-f]{8}$/);
    expect(a.metadata.bundle_id).toBe(b.metadata.bundle_id);
  });

  it('writes a bundle that passes the same verification as a real one', async () => {
    const bundle = generate({
      'cabai-merah-keriting': series((i) => 40_000 + (i % 20) * 500),
      'bawang-merah': series(() => 38_900),
      'beras-medium-1': series(() => 16_100),
    });
    const dir = await mkdtemp(path.join(tmpdir(), 'kp-demo-'));
    await writeBundleDir(dir, bundle);
    expect(verifyBundle(await readBundle(dir), now)).toEqual({ ok: true });
  });
});

describe('generateDemoBundle when the latest observation is today', () => {
  it('never sets the data cutoff after the issue time', async () => {
    const todayRun = new Date('2026-09-30T03:00:00Z'); // 10:00 WIB on the base date
    const bundle = generateDemoBundle(
      new Map([['bawang-merah', series(() => 38_900)]] as [CommodityCode, PricePoint[]][]),
      { marketCode: 'PIKJ', now: todayRun },
    );
    expect(new Date(bundle.metadata.data_cutoff).getTime()).toBeLessThanOrEqual(todayRun.getTime());
    const dir = await mkdtemp(path.join(tmpdir(), 'kp-demo-today-'));
    await writeBundleDir(dir, bundle);
    expect(verifyBundle(await readBundle(dir), todayRun)).toEqual({ ok: true });
  });
});

describe('generateDemoBundle refresh', () => {
  it('gets a new bundle id when regenerated later, so an expired demo can be refreshed', () => {
    const input = new Map([['bawang-merah', series(() => 38_900)]] as [
      CommodityCode,
      PricePoint[],
    ][]);
    const first = generateDemoBundle(input, { marketCode: 'PIKJ', now });
    const later = generateDemoBundle(input, {
      marketCode: 'PIKJ',
      now: new Date(now.getTime() + 10 * 86_400_000),
    });
    expect(later.metadata.bundle_id).not.toBe(first.metadata.bundle_id);
  });
});
