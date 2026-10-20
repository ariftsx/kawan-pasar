import { describe, expect, it } from 'vitest';

import {
  COMING_SOON,
  DEMO_AYAM_GEPREK,
  LIVE_AYAM_GEPREK,
  forecast,
  line,
  priced,
} from './ayam-geprek.fixture.js';
import { calculateMenuCost, type MenuCost, type MenuCostInput } from './cost.js';

import type { Result } from './result.js';

function unwrap(result: Result<MenuCost>): MenuCost {
  if (!result.ok) throw new Error(result.error.message);
  return result.value;
}

function errorCode(input: MenuCostInput): string | undefined {
  const result = calculateMenuCost(input);
  return result.ok ? undefined : result.error.code;
}

describe('calculateMenuCost · official examples', () => {
  it('matches the live 3-commodity example (docs 08 §5.2)', () => {
    const cost = unwrap(calculateMenuCost({ lines: LIVE_AYAM_GEPREK, portionsPerDay: 60 }));

    expect(cost.completeness).toBe('partial');
    expect(cost.coverage).toEqual({
      itemsTotal: 5,
      itemsPriced: 3,
      missingIngredients: ['daging-ayam-ras', 'minyak-goreng'],
    });
    expect(cost.perPortionTodayIdr).toBe(3826);
    expect(cost.perPortionOutlookIdr).toBe(3892);
    expect(cost.deltaRatio).toBeCloseTo(0.0173, 4);
    expect(cost.perDayTodayIdr).toBe(229_560);
    expect(cost.perDayOutlookIdr).toBe(233_520);
    expect(cost.items.map((item) => item.costTodayIdr)).toEqual([2096, 380, 1350, null, null]);
    expect(cost.items.map((item) => item.costOutlookIdr)).toEqual([2155, 384, 1353, null, null]);
    expect(cost.items[0]?.shareRatio).toBeCloseTo(0.548, 3);
    expect(cost.items[3]?.shareRatio).toBeNull();
  });

  it('matches the DATA DEMO example (docs 05 §4): Rp 10.850 → Rp 10.914', () => {
    const cost = unwrap(
      calculateMenuCost({ lines: DEMO_AYAM_GEPREK, portionsPerDay: 100, sellPriceIdr: 15_000 }),
    );

    expect(cost.completeness).toBe('complete');
    expect(cost.perPortionTodayIdr).toBe(10_850);
    expect(cost.perPortionOutlookIdr).toBe(10_914);
    expect(cost.deltaRatio).toBeCloseTo(0.0059, 4);
    expect(cost.perDayTodayIdr).toBe(1_085_000);
    expect(cost.perDayOutlookIdr).toBe(1_091_400);
    expect(cost.marginTodayIdr).toBe(4150);
    expect(cost.marginOutlookIdr).toBe(4086);
  });
});

describe('calculateMenuCost · partial and empty cost', () => {
  it('never turns an unpriced ingredient into Rp 0 and withholds margin', () => {
    const cost = unwrap(
      calculateMenuCost({ lines: LIVE_AYAM_GEPREK, portionsPerDay: 60, sellPriceIdr: 15_000 }),
    );

    expect(cost.items[3]).toMatchObject({ priceStatus: 'coming_soon', costTodayIdr: null });
    expect(cost.marginTodayIdr).toBeNull();
    expect(cost.marginOutlookIdr).toBeNull();
  });

  it('returns null totals when no ingredient has a price', () => {
    const cost = unwrap(
      calculateMenuCost({
        lines: [line('daging-ayam-ras', 150, 'g', COMING_SOON)],
        portionsPerDay: 10,
      }),
    );

    expect(cost.perPortionTodayIdr).toBeNull();
    expect(cost.perDayOutlookIdr).toBeNull();
    expect(cost.deltaRatio).toBeNull();
    expect(cost.marginTodayIdr).toBeNull();
  });

  it('handles a menu with no lines as complete but empty', () => {
    const cost = unwrap(calculateMenuCost({ lines: [], portionsPerDay: 0, sellPriceIdr: 5000 }));

    expect(cost.completeness).toBe('complete');
    expect(cost.perPortionTodayIdr).toBeNull();
    expect(cost.marginTodayIdr).toBeNull();
  });

  it('reports no delta or share when every priced line costs Rp 0', () => {
    const cost = unwrap(
      calculateMenuCost({ lines: [line('air', 100, 'ml', priced(0, 'l'))], portionsPerDay: 1 }),
    );

    expect(cost.perPortionTodayIdr).toBe(0);
    expect(cost.deltaRatio).toBeNull();
    expect(cost.items[0]?.shareRatio).toBeNull();
  });
});

describe('calculateMenuCost · outlook statuses', () => {
  it('uses today price for not-modeled and missing forecasts', () => {
    const cost = unwrap(
      calculateMenuCost({
        lines: [
          line('gula', 10, 'g', priced(18_000)),
          line('cabai-merah-keriting', 10, 'g', priced(50_000), { status: 'missing' }),
        ],
        portionsPerDay: 1,
      }),
    );

    expect(cost.perPortionOutlookIdr).toBe(cost.perPortionTodayIdr);
  });

  it('applies the change for stale, candidate, and in-development forecasts', () => {
    const statuses = ['stale', 'candidate', 'in_development'] as const;
    for (const status of statuses) {
      const cost = unwrap(
        calculateMenuCost({
          lines: [
            line('cabai-merah-keriting', 100, 'g', priced(50_000), {
              status,
              predictedChange: 0.1,
            }),
          ],
          portionsPerDay: 1,
        }),
      );
      expect(cost.perPortionOutlookIdr).toBe(5500);
    }
  });

  it('treats a stale price like an available one', () => {
    const stale = { status: 'stale', unitPriceIdr: 50_000, priceUnit: 'kg' } as const;
    const cost = unwrap(
      calculateMenuCost({ lines: [line('bawang-merah', 20, 'g', stale)], portionsPerDay: 2 }),
    );

    expect(cost.perPortionTodayIdr).toBe(1000);
    expect(cost.completeness).toBe('complete');
  });
});

describe('calculateMenuCost · validation', () => {
  const ok = [line('beras-medium-1', 100, 'g', priced(13_500))];

  it.each([
    [{ lines: ok, portionsPerDay: -1 }, 'INVALID_PORTIONS'],
    [{ lines: ok, portionsPerDay: 1.5 }, 'INVALID_PORTIONS'],
    [{ lines: ok, portionsPerDay: 1, sellPriceIdr: 99.5 }, 'INVALID_SELL_PRICE'],
    [{ lines: [line('beras-medium-1', 100, 'g', priced(-1))], portionsPerDay: 1 }, 'INVALID_PRICE'],
    [
      { lines: [line('beras-medium-1', 0, 'g', priced(13_500))], portionsPerDay: 1 },
      'INVALID_QUANTITY',
    ],
    [
      { lines: [line('beras-medium-1', 1, 'ml', priced(13_500))], portionsPerDay: 1 },
      'UNIT_MISMATCH',
    ],
    [
      { lines: [line('cabai', 1, 'g', priced(50_000), forecast(-1))], portionsPerDay: 1 },
      'INVALID_CHANGE',
    ],
    [
      { lines: [line('cabai', 1, 'g', priced(50_000), forecast(Number.NaN))], portionsPerDay: 1 },
      'INVALID_CHANGE',
    ],
  ] as const)('rejects invalid input %#', (input, code) => {
    expect(errorCode(input)).toBe(code);
  });
});
