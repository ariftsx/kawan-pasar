import { describe, expect, it } from 'vitest';
import { decodeSeries, encodeSeries, mergeHistory, transform, withinRange } from './series';

const p = (observedOn: string, priceIdr: number) => ({ observedOn, priceIdr });

describe('Mode Analis series', () => {
  it('uses daily points for the last year and the coarse ones before, without duplicates', () => {
    const coarse = [p('2024-01-01', 100), p('2025-06-01', 110), p('2026-01-05', 120)];
    const daily = [p('2025-10-01', 115), p('2026-01-05', 121), p('2026-01-06', 122)];
    expect(mergeHistory(coarse, daily)).toEqual([
      { day: '2024-01-01', price: 100 },
      { day: '2025-06-01', price: 110 },
      { day: '2025-10-01', price: 115 },
      { day: '2026-01-05', price: 121 },
      { day: '2026-01-06', price: 122 },
    ]);
  });

  it('cuts a range back from the latest day of all series', () => {
    const s = [
      { day: '2025-01-01', price: 1 },
      { day: '2026-07-02', price: 2 },
      { day: '2026-09-30', price: 3 },
    ];
    expect(withinRange(s, '90h', '2026-09-30').map((x) => x.day)).toEqual([
      '2026-07-02',
      '2026-09-30',
    ]);
    expect(withinRange(s, 'semua', '2026-09-30')).toHaveLength(3);
  });

  it('index = 100 at the first point; change = relative to the first point; price as is', () => {
    const s = [
      { day: 'a', price: 40_000 },
      { day: 'b', price: 44_000 },
      { day: 'c', price: 38_000 },
    ];
    expect(transform(s, 'indeks').map((x) => x.value)).toEqual([100, 110, 95]);
    expect(transform(s, 'perubahan').map((x) => Math.round(x.value * 10) / 10)).toEqual([
      0, 10, -5,
    ]);
    expect(transform(s, 'harga').map((x) => x.value)).toEqual([40_000, 44_000, 38_000]);
    expect(transform([], 'indeks')).toEqual([]);
  });
});

describe('compact series (sent to the browser)', () => {
  it('round-trips through day deltas and prices', () => {
    const s = [
      { day: '2024-12-30', price: 40_000 },
      { day: '2025-01-06', price: 41_000 },
      { day: '2025-01-07', price: 40_500 },
      { day: '2025-03-01', price: 39_000 },
    ];
    const c = encodeSeries(s);
    expect(c).toEqual({
      start: '2024-12-30',
      gaps: [7, 1, 53],
      prices: [40_000, 41_000, 40_500, 39_000],
    });
    expect(decodeSeries(c)).toEqual(s);
    expect(decodeSeries(encodeSeries([]))).toEqual([]);
  });
});
