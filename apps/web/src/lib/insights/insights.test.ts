import type { CommoditySummary, ForecastResponse, PricePoint } from '@kawan-pasar/contracts';
import { describe, expect, it } from 'vitest';
import { changesFromHistory } from './changes';
import { forecastView } from './forecast-view';
import { isPageStale } from './freshness';
import { weeklyHighlights } from './highlights';
import { kataKapa } from './kata-kapa';

const item = (over: Partial<CommoditySummary>): CommoditySummary => ({
  code: 'cabai-merah-keriting',
  name: 'Cabai merah keriting',
  unit: 'kg',
  modelCoverage: 'covered',
  dataStatus: 'fresh',
  latest: { observedOn: '2026-09-30', priceIdr: 63_150 },
  change7d: 0,
  change30d: 0.4223,
  sparkline: [],
  forecast7d: { status: 'available', q50Change: 0, direction: 'flat' },
  ...over,
});

// The seed dataset as served on 12 Nov 2026.
const seed: CommoditySummary[] = [
  item({ dataStatus: 'stale' }),
  item({
    code: 'bawang-merah',
    name: 'Bawang merah',
    dataStatus: 'stale',
    latest: { observedOn: '2026-09-30', priceIdr: 40_300 },
    change7d: 0.0661,
    change30d: 0,
  }),
  item({
    code: 'beras-medium-1',
    name: 'Beras medium I',
    dataStatus: 'stale',
    latest: { observedOn: '2026-09-30', priceIdr: 16_100 },
    change7d: 0,
    change30d: 0,
  }),
  item({
    code: 'cabai-rawit-hijau',
    name: 'Cabai rawit hijau',
    modelCoverage: 'pending',
    dataStatus: 'no_data',
    latest: null,
    change7d: null,
    change30d: null,
    forecast7d: { status: 'pending_coverage', q50Change: null, direction: null },
  }),
];

/** Seed entry by index (throws instead of a non-null assertion). */
function at(i: number): CommoditySummary {
  const s = seed[i];
  if (s === undefined) throw new Error(`no seed item ${String(i)}`);
  return s;
}

describe('weeklyHighlights', () => {
  it('picks the largest rise, reports no fall when nothing fell, and counts forecasts', () => {
    const h = weeklyHighlights(seed);
    expect(h.topRise?.code).toBe('bawang-merah');
    expect(h.topFall).toBeNull();
    expect(h.forecast).toEqual({ up: 0, down: 0, flat: 3, expired: false });
  });

  it('ignores commodities without data and changes that round to 0,0%', () => {
    const h = weeklyHighlights([item({ change7d: 0.0004 }), at(3)]);
    expect(h.topRise).toBeNull();
  });

  it('counts no forecast when none may be shown', () => {
    const hidden = seed.map((s) => ({
      ...s,
      forecast7d: { status: 'hidden' as const, q50Change: null, direction: null },
    }));
    expect(weeklyHighlights(hidden).forecast).toBeNull();
  });
});

describe('kataKapa', () => {
  const banned = /\b(karena|beli|jual|pasti|dijamin)\b/i;

  it('warns first when the data is late, with the data date', () => {
    const k = kataKapa(at(0));
    expect(k?.pose).toBe('waspada');
    expect(k?.body).toContain('30 September 2026');
  });

  it('states large monthly moves as facts', () => {
    const k = kataKapa(item({}));
    expect(k?.title).toBe('Cabai merah keriting naik 42,2% dalam sebulan.');
  });

  it('never uses causal or buy/sell language', () => {
    for (const s of [...seed, item({}), item({ change30d: -0.08 }), item({ change30d: 0.01 })]) {
      const k = kataKapa(s);
      if (k !== null) expect(`${k.title} ${k.body}`).not.toMatch(banned);
    }
  });

  it('says nothing about commodities without data', () => {
    expect(kataKapa(at(3))).toBeNull();
  });
});

describe('changesFromHistory', () => {
  const points: PricePoint[] = [
    { observedOn: '2026-06-30', priceIdr: 40_000 },
    { observedOn: '2026-08-31', priceIdr: 45_000 },
    { observedOn: '2026-09-22', priceIdr: 50_000 },
    { observedOn: '2026-09-29', priceIdr: 51_000 },
    { observedOn: '2026-09-30', priceIdr: 52_000 },
  ];

  it('compares with the last observation on or before the reference day', () => {
    expect(changesFromHistory(points, 1)).toBeCloseTo(52_000 / 51_000 - 1, 6);
    // 7 days before 30 Sep = 23 Sep, no observation → the 22 Sep one.
    expect(changesFromHistory(points, 7)).toBeCloseTo(0.04, 6);
    expect(changesFromHistory(points, 30)).toBeCloseTo(52_000 / 45_000 - 1, 6);
    expect(changesFromHistory(points, 90)).toBeCloseTo(0.3, 6);
  });

  it('returns null when no earlier observation exists', () => {
    expect(changesFromHistory(points.slice(-1), 7)).toBeNull();
    expect(changesFromHistory([], 7)).toBeNull();
  });
});

const forecast = (over: Partial<ForecastResponse>): ForecastResponse => ({
  market: { code: 'PIKJ', name: 'Pasar Kramat Jati', city: 'Jakarta Timur', status: 'available' },
  commodity: {
    code: 'cabai-merah-keriting',
    name: 'Cabai merah keriting',
    modelCoverage: 'covered',
  },
  status: 'available',
  artifact: {
    modelName: 'demo',
    modelVersion: 'demo-empirical-quantile-v1',
    dataVersion: 'seed-csv-2026-09-30',
    preprocessVersion: 'none',
    dataCutoff: '2026-09-30T16:59:59.000Z',
    issuedAt: '2026-11-11T22:21:50.025Z',
    isDemo: true,
    ageDays: 0,
  },
  baseDate: '2026-09-30',
  basePriceIdr: 63_150,
  horizons: [
    {
      horizonDays: 7,
      targetDate: '2026-10-07',
      q10Change: -0.12,
      q50Change: 0,
      q90Change: 0.17,
      q10PriceIdr: 55_460,
      q50PriceIdr: 63_150,
      q90PriceIdr: 73_735,
      evalStatus: 'available',
    },
    {
      horizonDays: 180,
      targetDate: '2027-03-29',
      q10Change: null,
      q50Change: null,
      q90Change: null,
      q10PriceIdr: null,
      q50PriceIdr: null,
      q90PriceIdr: null,
      evalStatus: 'not_tested',
    },
  ],
  ...over,
});

describe('forecastView', () => {
  it('shows numbers with demo and version labels for an available forecast', () => {
    const v = forecastView(forecast({}));
    expect(v.showNumbers).toBe(true);
    expect(v.labels).toEqual(['Data demo']);
    expect(v.rows[0]).toMatchObject({
      label: '7 hari',
      target: 'Rab, 7 Okt 2026',
      change: 'stabil',
      price: 'Rp 63.150',
      range: 'Rp 55.460 – Rp 73.735',
      eval: 'Tersedia',
    });
    expect(v.rows[1]).toMatchObject({ change: '—', price: '—', range: '—', eval: 'Belum diuji' });
  });

  it('labels an expired forecast', () => {
    expect(forecastView(forecast({ status: 'expired' })).labels).toEqual([
      'Kedaluwarsa',
      'Data demo',
    ]);
  });

  it.each(['hidden', 'unavailable', 'pending_coverage'] as const)(
    'shows no numbers at all when the status is %s',
    (status) => {
      const v = forecastView(forecast({ status }));
      expect(v.showNumbers).toBe(false);
      expect(v.rows).toEqual([]);
    },
  );
});

describe('isPageStale', () => {
  it('applies the 2-business-day rule against today in WIB', () => {
    // Friday 2 Oct 2026 → Monday 5 Oct is 1 business day, Wednesday 7 Oct is 3.
    expect(isPageStale('2026-10-02', new Date('2026-10-05T10:00:00+07:00'))).toBe(false);
    expect(isPageStale('2026-10-02', new Date('2026-10-07T10:00:00+07:00'))).toBe(true);
    expect(isPageStale(null, new Date())).toBe(false);
  });
});
