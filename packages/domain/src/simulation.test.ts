import { describe, expect, it } from 'vitest';

import { COMING_SOON, DEMO_AYAM_GEPREK, LIVE_AYAM_GEPREK, line } from './ayam-geprek.fixture.js';
import { calculateMenuCost, type MenuCost } from './cost.js';
import { simulatePriceIncrease } from './simulation.js';

function costOf(result: ReturnType<typeof calculateMenuCost>): MenuCost {
  if (!result.ok) throw new Error(result.error.message);
  return result.value;
}

const demo = costOf(calculateMenuCost({ lines: DEMO_AYAM_GEPREK, portionsPerDay: 100 }));

function errorCode(result: ReturnType<typeof simulatePriceIncrease>): string | undefined {
  return result.ok ? undefined : result.error.code;
}

describe('simulatePriceIncrease', () => {
  it('adds the increase on today cost of one ingredient', () => {
    const result = simulatePriceIncrease(demo, 'cabai-merah-keriting', 0.5, 100);

    expect(result).toEqual({
      ok: true,
      value: {
        ingredientId: 'cabai-merah-keriting',
        increaseRatio: 0.5,
        perPortionIdr: 11_898,
        perDayIdr: 1_189_800,
        deltaPerPortionIdr: 1048,
        deltaPerDayIdr: 104_800,
      },
    });
  });

  it('works on a partial cost for a priced ingredient', () => {
    const live = costOf(calculateMenuCost({ lines: LIVE_AYAM_GEPREK, portionsPerDay: 60 }));
    const result = simulatePriceIncrease(live, 'bawang-merah', 1, 60);

    expect(result.ok && result.value.perPortionIdr).toBe(4206);
  });

  it.each([
    [-0.1, 'INVALID_INCREASE'],
    [1.01, 'INVALID_INCREASE'],
    [Number.NaN, 'INVALID_INCREASE'],
  ])('rejects increase %d', (increase, code) => {
    expect(errorCode(simulatePriceIncrease(demo, 'bawang-merah', increase, 1))).toBe(code);
  });

  it('rejects invalid portions, unknown and unpriced ingredients', () => {
    const partial = costOf(
      calculateMenuCost({
        lines: [line('daging-ayam-ras', 150, 'g', COMING_SOON)],
        portionsPerDay: 1,
      }),
    );

    expect(errorCode(simulatePriceIncrease(demo, 'bawang-merah', 0.1, -1))).toBe(
      'INVALID_PORTIONS',
    );
    expect(errorCode(simulatePriceIncrease(demo, 'garam', 0.1, 1))).toBe('INGREDIENT_NOT_FOUND');
    expect(errorCode(simulatePriceIncrease(partial, 'daging-ayam-ras', 0.1, 1))).toBe(
      'INGREDIENT_NOT_PRICED',
    );
  });
});
