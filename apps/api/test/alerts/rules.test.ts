import { describe, expect, it } from 'vitest';
import {
  crossed,
  forecastRise,
  forecastRiseNews,
  sevenDayChange,
  thresholdNews,
  unusualMove,
  unusualMoveNews,
  usualSevenDayRange,
} from '../../src/modules/alerts/rules.js';
import type { Point } from '../../src/modules/alerts/rules.js';

const day = (iso: string): number => Date.parse(`${iso}T00:00:00Z`) / 86_400_000;
const series = (rows: [string, number][]): Point[] =>
  rows.map(([d, p]) => ({ day: day(d), price: p }));

/** A quiet year (±1 % moves) followed by a final jump. */
function quietThenJump(jump: number): Point[] {
  const out: Point[] = [];
  for (let i = 0; i < 400; i += 1) {
    out.push({ day: day('2025-08-01') + i, price: i % 2 === 0 ? 40_000 : 40_400 });
  }
  const last = out.at(-1)?.day ?? 0;
  out.push({ day: last + 1, price: Math.round(40_000 * (1 + jump)) });
  return out;
}

describe('7-day change and the usual range', () => {
  it('compares the last price with the last one on or before 7 days earlier', () => {
    const s = series([
      ['2026-09-20', 100],
      ['2026-09-23', 110],
      ['2026-09-30', 121],
    ]);
    expect(sevenDayChange(s)).toBeCloseTo(0.1); // 121 vs 110 (23 Sep = exactly 7 days)
    expect(sevenDayChange(series([['2026-09-30', 1]]))).toBeNull();
  });

  it('the usual range is the 90th percentile of absolute 7-day changes', () => {
    const range = usualSevenDayRange(quietThenJump(0));
    expect(range).not.toBeNull();
    expect(range ?? 0).toBeGreaterThan(0.009);
    expect(range ?? 1).toBeLessThan(0.011);
  });

  it('only a move beyond the usual range is unusual, both up and down', () => {
    expect(unusualMove(quietThenJump(0.2))).toMatchObject({ direction: 'up' });
    expect(unusualMove(quietThenJump(-0.2))).toMatchObject({ direction: 'down' });
    expect(unusualMove(quietThenJump(0.005))).toBeNull();
    // Too little history: no claim about what is usual.
    expect(unusualMove(quietThenJump(0.2).slice(-30))).toBeNull();
  });
});

describe('own price limit', () => {
  it('fires when the price crosses the limit, not every day it stays beyond', () => {
    expect(crossed(37_800, 40_300, 39_000, 'above')).toBe(true);
    expect(crossed(40_300, 40_500, 39_000, 'above')).toBe(false);
    expect(crossed(39_000, 39_000, 39_000, 'above')).toBe(false);
    expect(crossed(39_000, 39_001, 39_000, 'above')).toBe(true);
    expect(crossed(16_200, 16_100, 16_150, 'below')).toBe(true);
    expect(crossed(16_100, 16_000, 16_150, 'below')).toBe(false);
  });
});

describe('forecast rise', () => {
  const h = (horizonDays: number, q50: number): Parameters<typeof forecastRise>[0][number] => ({
    horizonDays,
    q10Change: q50 - 0.1,
    q50Change: q50,
    q90Change: q50 + 0.1,
    q50PriceIdr: 41_000,
    q10PriceIdr: 37_000,
    q90PriceIdr: 45_000,
  });

  it('uses the 7-day median first, then the 30-day one, and needs more than +2 %', () => {
    expect(forecastRise([h(7, 0.021), h(30, 0.05)])?.horizonDays).toBe(7);
    expect(forecastRise([h(7, 0.01), h(30, 0.05)])?.horizonDays).toBe(30);
    expect(forecastRise([h(7, 0.02), h(30, 0.02)])).toBeNull();
    expect(forecastRise([h(90, 0.3)])).toBeNull();
  });
});

describe('news text: facts only, Indonesian number format, no advice or causes', () => {
  const FORBIDDEN = /\b(karena|sebaiknya|segera beli|jual sekarang|pasti|disebabkan|akibat)\b/i;

  it('unusual move', () => {
    const n = unusualMoveNews({
      commodityName: 'Cabai merah keriting',
      marketName: 'Pasar Kramat Jati',
      price: 63_150,
      change: 0.182,
      usual: 0.091,
      dataDate: '2026-09-30',
    });
    expect(n.title).toBe('Cabai merah keriting naik 18,2% dalam 7 hari');
    expect(n.body).toBe(
      'Rp 63.150/kg di Pasar Kramat Jati (data 30 Sep 2026). Perubahan 7 hari biasanya tidak lebih dari 9,1%.',
    );
    expect(`${n.title} ${n.body}`).not.toMatch(FORBIDDEN);
  });

  it('forecast rise names the model version and says it is an estimate', () => {
    const n = forecastRiseNews({
      commodityName: 'Bawang merah',
      horizonDays: 30,
      q50Change: 0.034,
      q10PriceIdr: 36_000,
      q50PriceIdr: 41_670,
      q90PriceIdr: 48_000,
      modelVersion: 'arifnet-a0-v1.1.0+647e1317',
      dataDate: '2026-09-30',
    });
    expect(n.title).toBe('Prediksi: bawang merah naik 3,4% dalam 30 hari');
    expect(n.body).toContain('Rp 41.670/kg (rentang Rp 36.000–Rp 48.000)');
    expect(n.body).toContain('arifnet-a0-v1.1.0+647e1317');
    expect(n.body).toContain('bukan jaminan harga');
    expect(`${n.title} ${n.body}`).not.toMatch(FORBIDDEN);
  });

  it('own limit', () => {
    const n = thresholdNews({
      commodityName: 'Bawang merah',
      marketName: 'Pasar Kramat Jati',
      previous: 37_800,
      price: 40_300,
      threshold: 39_000,
      direction: 'above',
      dataDate: '2026-09-30',
    });
    expect(n.title).toBe('Bawang merah di atas batas Anda (Rp 39.000/kg)');
    expect(n.body).toBe(
      'Rp 40.300/kg di Pasar Kramat Jati pada 30 Sep 2026, sebelumnya Rp 37.800/kg.',
    );
  });
});
