import { getIngredient, getTemplate } from '@kawan-pasar/catalog';
import { describe, expect, it } from 'vitest';

import {
  buildRecipeLines,
  costMenu,
  ingredientNames,
  outlookFor,
  priceFor,
  riskiestIngredient,
  summarisePlan,
  type OutlookMap,
} from './plan';

/** The 7-day DATA DEMO outlook from the model service demo bundle. */
const DEMO_OUTLOOK: OutlookMap = new Map([
  ['cabai-merah-keriting', { status: 'in_development', predictedChange: 0.028 }],
  ['bawang-merah', { status: 'in_development', predictedChange: 0.009 }],
  ['beras-medium-1', { status: 'in_development', predictedChange: 0 }],
]);

function template(slug: string) {
  const found = getTemplate(slug);
  if (found === undefined) throw new Error(slug);
  return found;
}

function ingredient(slug: string) {
  const found = getIngredient(slug);
  if (found === undefined) throw new Error(slug);
  return found;
}

describe('priceFor', () => {
  it('uses the labelled sample price in demo mode', () => {
    expect(priceFor(ingredient('minyak-goreng'), 'demo')).toEqual({
      status: 'available',
      unitPriceIdr: 40_000,
      priceUnit: 'l',
    });
  });

  it('has no price in live mode until F2: missing for model commodities, coming_soon else', () => {
    expect(priceFor(ingredient('cabai-merah-keriting'), 'live')).toEqual({ status: 'missing' });
    expect(priceFor(ingredient('daging-ayam-ras'), 'live')).toEqual({ status: 'coming_soon' });
  });
});

describe('outlookFor', () => {
  it('gives non-model ingredients "tanpa perkiraan"', () => {
    expect(outlookFor(ingredient('tempe'), DEMO_OUTLOOK)).toEqual({ status: 'not_modeled' });
  });

  it('marks a model commodity without a served forecast as missing', () => {
    expect(outlookFor(ingredient('bawang-merah'), new Map())).toEqual({ status: 'missing' });
  });
});

describe('costMenu', () => {
  it('reproduces the official DATA DEMO example: Rp 10.850 → Rp 10.914 (docs 05 §4)', () => {
    const cost = costMenu(template('ayam-geprek-nasi'), 'demo', DEMO_OUTLOOK);
    expect(cost?.perPortionTodayIdr).toBe(10_850);
    expect(cost?.perPortionOutlookIdr).toBe(10_914);
    expect(cost?.completeness).toBe('complete');
    expect(cost?.marginTodayIdr).toBe(15_000 - 10_850);
  });

  it('is partial in live mode and never counts a missing price as 0 (PLAN-09)', () => {
    const cost = costMenu(template('ayam-geprek-nasi'), 'live', DEMO_OUTLOOK);
    expect(cost?.completeness).toBe('partial');
    expect(cost?.perPortionTodayIdr).toBeNull();
    expect(cost?.marginTodayIdr).toBeNull();
  });

  it('carries the egg weight so a per-piece recipe prices per kg', () => {
    const lines = buildRecipeLines(template('nasi-telur-balado').recipe, 'demo', DEMO_OUTLOOK);
    expect(lines.find((line) => line.ingredientId === 'telur-ayam-ras')?.gramsPerPiece).toBe(60);
    expect(costMenu(template('nasi-telur-balado'), 'demo', DEMO_OUTLOOK)).not.toBeNull();
  });

  it('drops ingredients the catalog no longer knows', () => {
    const lines = buildRecipeLines(
      [{ ingredient: 'kopi', qty: 10, unit: 'g' }],
      'demo',
      DEMO_OUTLOOK,
    );
    expect(lines).toEqual([]);
  });

  it('returns null when the domain rejects the menu', () => {
    expect(
      costMenu({ recipe: [], portions_per_day: -1, sell_price_idr: null }, 'demo', DEMO_OUTLOOK),
    ).toBeNull();
  });
});

describe('riskiestIngredient', () => {
  it('picks the largest expected increase in rupiah', () => {
    const cost = costMenu(template('ayam-geprek-nasi'), 'demo', DEMO_OUTLOOK);
    expect(cost === null ? null : riskiestIngredient(cost)?.ingredientId).toBe(
      'cabai-merah-keriting',
    );
  });

  it('falls back to the largest share when nothing is forecast to rise', () => {
    const cost = costMenu(template('ayam-geprek-nasi'), 'demo', new Map());
    expect(cost === null ? null : riskiestIngredient(cost)?.ingredientId).toBe('daging-ayam-ras');
  });

  it('is null when no ingredient has a price', () => {
    const cost = costMenu(template('ayam-geprek-nasi'), 'live', new Map());
    expect(cost === null ? 'no cost' : riskiestIngredient(cost)).toBeNull();
  });
});

describe('summarisePlan', () => {
  it('adds menus per day and ranks ingredients by their daily cost', () => {
    const geprek = template('ayam-geprek-nasi');
    const lele = template('pecel-lele');
    const summary = summarisePlan([
      { cost: costMenu(geprek, 'demo', DEMO_OUTLOOK), portions_per_day: geprek.portions_per_day },
      { cost: costMenu(lele, 'demo', DEMO_OUTLOOK), portions_per_day: lele.portions_per_day },
    ]);
    expect(summary.menuCount).toBe(2);
    expect(summary.portionsPerDay).toBe(160);
    expect(summary.perDayTodayIdr).toBeGreaterThan(10_850 * 100);
    expect(summary.isPartial).toBe(false);
    expect(summary.shares[0]?.ingredientId).toBe('daging-ayam-ras');
    const totalShare = summary.shares.reduce((sum, share) => sum + share.shareRatio, 0);
    expect(totalShare).toBeCloseTo(1, 6);
    expect(summary.deltaRatio).toBeGreaterThan(0);
  });

  it('reports a partial plan with its missing ingredients', () => {
    const geprek = template('ayam-geprek-nasi');
    const summary = summarisePlan([
      { cost: costMenu(geprek, 'live', DEMO_OUTLOOK), portions_per_day: 100 },
    ]);
    expect(summary.isPartial).toBe(true);
    expect(summary.perDayTodayIdr).toBeNull();
    expect(summary.deltaRatio).toBeNull();
    expect(summary.itemsPriced).toBe(0);
    expect(summary.missingIngredients).toContain('daging-ayam-ras');
  });

  it('handles an empty plan and skips menus that could not be costed', () => {
    const summary = summarisePlan([{ cost: null, portions_per_day: 10 }]);
    expect(summary.perDayTodayIdr).toBeNull();
    expect(summary.shares).toEqual([]);
  });
});

describe('ingredientNames', () => {
  it('joins names the Indonesian way', () => {
    expect(ingredientNames([])).toBe('');
    expect(ingredientNames(['tempe'])).toBe('tempe');
    expect(ingredientNames(['daging-ayam-ras', 'minyak-goreng', 'kopi'])).toBe(
      'daging ayam ras, minyak goreng dan kopi',
    );
  });
});
