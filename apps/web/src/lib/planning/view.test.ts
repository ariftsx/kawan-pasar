import { getTemplate } from '@kawan-pasar/catalog';
import { describe, expect, it } from 'vitest';

import { costMenu, type OutlookMap } from './plan';
import { ingredientName, menuView, percentOf, rupiahOrNull } from './view';

const OUTLOOK: OutlookMap = new Map([
  ['cabai-merah-keriting', { status: 'in_development', predictedChange: 0.028 }],
  ['bawang-merah', { status: 'in_development', predictedChange: 0.009 }],
  ['beras-medium-1', { status: 'in_development', predictedChange: 0 }],
]);

const geprek = getTemplate('ayam-geprek-nasi');
if (geprek === undefined) throw new Error('template missing');

describe('menuView', () => {
  it('formats a complete demo menu (docs 05 §4)', () => {
    const view = menuView(costMenu(geprek, 'demo', OUTLOOK), true);
    expect(view.todayPerPortion).toBe(rupiahOrNull(10_850));
    expect(view.outlookPerPortion).toBe(rupiahOrNull(10_914));
    expect(view.todayPerDay).toBe(rupiahOrNull(1_085_000));
    expect(view.deltaRatio).toBeCloseTo(64 / 10_850, 6);
    expect(view.riskName).toBe('Cabai merah keriting');
    expect(view.riskShare).toBe('19%');
  });

  it('hides the outlook when none is served', () => {
    const view = menuView(costMenu(geprek, 'demo', OUTLOOK), false);
    expect(view.outlookPerPortion).toBeNull();
    expect(view.deltaRatio).toBeNull();
  });

  it('turns every unknown into null, never Rp 0', () => {
    expect(menuView(null, true)).toEqual({
      todayPerPortion: null,
      outlookPerPortion: null,
      todayPerDay: null,
      deltaRatio: null,
      riskName: null,
      riskShare: null,
    });
    const live = menuView(costMenu(geprek, 'live', OUTLOOK), true);
    expect(live.todayPerPortion).toBeNull();
    expect(live.riskName).toBeNull();
  });
});

describe('helpers', () => {
  it('format names and percentages', () => {
    expect(ingredientName('tempe')).toBe('Tempe');
    expect(ingredientName('kopi')).toBe('kopi');
    expect(percentOf(0.193)).toBe('19%');
    expect(rupiahOrNull(undefined)).toBeNull();
  });
});
