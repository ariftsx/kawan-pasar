import { describe, expect, it } from 'vitest';

import {
  computeMovementThreshold,
  computeWeeklyChanges,
  isUnusualMovement,
  quantileSorted,
  toDayNumber,
  type PricePoint,
} from './movement.js';

function dateAt(offsetDays: number): string {
  return new Date(Date.UTC(2024, 0, 1) + offsetDays * 86_400_000).toISOString().slice(0, 10);
}

/** Daily series whose price alternates so every Δ7d is known: day d costs 10.000 + 100 × (d mod 10). */
function dailySeries(days: number): PricePoint[] {
  return Array.from({ length: days }, (_, day) => ({
    date: dateAt(day),
    priceIdr: 10_000 + 100 * (day % 10),
  }));
}

function codeOf(result: { ok: boolean; error?: { code: string } }): string | undefined {
  return result.error?.code;
}

describe('toDayNumber', () => {
  it('parses real calendar dates only', () => {
    expect(toDayNumber('1970-01-02')).toBe(1);
    expect(toDayNumber('2026-02-30')).toBeNull();
    expect(toDayNumber('2026-1-5')).toBeNull();
    expect(toDayNumber('not a date')).toBeNull();
  });
});

describe('computeWeeklyChanges', () => {
  it('uses the observation exactly 7 days earlier', () => {
    const result = computeWeeklyChanges([
      { date: '2026-10-07', priceIdr: 50_000 },
      { date: '2026-10-14', priceIdr: 52_400 },
    ]);

    expect(result.ok && result.value.map((item) => item.date)).toEqual(['2026-10-14']);
    expect(result.ok && result.value[0]?.change).toBeCloseTo(0.048, 12);
  });

  it('falls back to the latest earlier observation within 7 extra days', () => {
    const result = computeWeeklyChanges([
      { date: '2026-10-01', priceIdr: 40_000 },
      { date: '2026-10-03', priceIdr: 50_000 },
      { date: '2026-10-14', priceIdr: 55_000 },
    ]);

    // 2026-10-03 is the latest point on or before 2026-10-07, so the reference is 50.000.
    expect(result.ok && result.value.map((item) => item.date)).toEqual(['2026-10-14']);
    expect(result.ok && result.value[0]?.change).toBeCloseTo(0.1, 12);
  });

  it('skips a day when no observation exists in the tolerance window', () => {
    const result = computeWeeklyChanges([
      { date: '2026-09-01', priceIdr: 40_000 },
      { date: '2026-10-14', priceIdr: 55_000 },
    ]);

    expect(result.ok && result.value).toEqual([]);
  });

  it.each([
    [[{ date: '2026-13-01', priceIdr: 1000 }], 'INVALID_DATE'],
    [[{ date: '2026-10-01', priceIdr: 0 }], 'INVALID_PRICE'],
    [[{ date: '2026-10-01', priceIdr: 10.5 }], 'INVALID_PRICE'],
    [
      [
        { date: '2026-10-02', priceIdr: 1000 },
        { date: '2026-10-01', priceIdr: 1000 },
      ],
      'UNSORTED_SERIES',
    ],
    [
      [
        { date: '2026-10-01', priceIdr: 1000 },
        { date: '2026-10-01', priceIdr: 1100 },
      ],
      'UNSORTED_SERIES',
    ],
  ])('rejects an invalid series %#', (points, code) => {
    expect(codeOf(computeWeeklyChanges(points))).toBe(code);
  });
});

describe('quantileSorted', () => {
  it('interpolates linearly like numpy.quantile', () => {
    expect(quantileSorted([1, 2, 3, 4], 0.95)).toBeCloseTo(3.85, 10);
    expect(quantileSorted([1, 2, 3, 4], 1)).toBe(4);
    expect(quantileSorted([7], 0.95)).toBe(7);
    expect(quantileSorted([], 0.95)).toBeNaN();
  });
});

describe('computeMovementThreshold', () => {
  const series = dailySeries(400);

  it('computes q95 from changes strictly before the calculation date', () => {
    const result = computeMovementThreshold(series, dateAt(300));

    expect(result.ok).toBe(true);
    if (!result.ok || result.value.status !== 'available') return;
    // 300 days minus the first 7 without a reference.
    expect(result.value.nObs).toBe(293);
    expect(result.value.windowEnd).toBe(dateAt(299));
    expect(result.value.q95AbsChange).toBeGreaterThan(0);
  });

  it('ignores future data: adding points after the date does not change the threshold', () => {
    const before = computeMovementThreshold(series.slice(0, 301), dateAt(300));
    const withFuture = computeMovementThreshold(series, dateAt(300));

    expect(withFuture).toEqual(before);
  });

  it('reports insufficient coverage below the minimum number of observations', () => {
    const result = computeMovementThreshold(series, dateAt(100));

    expect(result).toEqual({ ok: true, value: { status: 'insufficient_coverage', nObs: 93 } });
  });

  it('reports insufficient coverage for an empty window even with no minimum', () => {
    const result = computeMovementThreshold([], '2026-10-20', { minObservations: 0 });

    expect(result).toEqual({ ok: true, value: { status: 'insufficient_coverage', nObs: 0 } });
  });

  it('rejects an invalid calculation date or series', () => {
    expect(codeOf(computeMovementThreshold(series, '2026-02-30'))).toBe('INVALID_DATE');
    expect(codeOf(computeMovementThreshold([{ date: 'x', priceIdr: 1 }], '2026-10-20'))).toBe(
      'INVALID_DATE',
    );
  });
});

describe('isUnusualMovement', () => {
  const threshold = {
    status: 'available',
    q95AbsChange: 0.089,
    nObs: 300,
    windowEnd: '2026-10-19',
  } as const;

  it('fires only strictly above the threshold, in either direction', () => {
    expect(isUnusualMovement(0.09, threshold)).toBe(true);
    expect(isUnusualMovement(-0.12, threshold)).toBe(true);
    expect(isUnusualMovement(0.089, threshold)).toBe(false);
    expect(isUnusualMovement(0.032, threshold)).toBe(false);
  });

  it('never fires without a threshold', () => {
    expect(isUnusualMovement(0.5, { status: 'insufficient_coverage', nObs: 10 })).toBe(false);
  });
});
