import { describe, expect, it } from 'vitest';

import { isNonNegativeSafeInteger, roundRupiah, sumRupiah } from './money.js';

describe('roundRupiah', () => {
  it.each([
    [2154.688, 2155],
    [383.8, 384],
    [0.5, 1],
    [1352.4999, 1352],
    // 0.1 × 3 is 0.30000000000000004 in binary; the noise must not move the result.
    [0.1 * 3 * 5, 2],
    [-2.5, -3],
    [0, 0],
  ])('rounds %d to %d', (value, expected) => {
    expect(roundRupiah(value)).toBe(expected);
  });
});

describe('money helpers', () => {
  it('accepts only non-negative safe integers', () => {
    expect(isNonNegativeSafeInteger(0)).toBe(true);
    expect(isNonNegativeSafeInteger(52_400)).toBe(true);
    expect(isNonNegativeSafeInteger(-1)).toBe(false);
    expect(isNonNegativeSafeInteger(1.5)).toBe(false);
    expect(isNonNegativeSafeInteger(2 ** 53)).toBe(false);
  });

  it('sums rupiah amounts', () => {
    expect(sumRupiah([2155, 384, 1353])).toBe(3892);
    expect(sumRupiah([])).toBe(0);
  });
});
