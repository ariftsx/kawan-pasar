import { calculateMenuCost, type RecipeLine } from '@kawan-pasar/domain';
import { describe, expect, it } from 'vitest';

import {
  CATALOG_VERSION,
  getIngredient,
  getTemplate,
  listIngredients,
  listTemplates,
  listWarungTypes,
  modelCommodities,
  type MenuTemplate,
} from './index.js';

/** Demo-mode lines: every ingredient carries its labelled sample price, no outlook. */
function demoLines(template: MenuTemplate): RecipeLine[] {
  return template.recipe.map((item) => {
    const ingredient = getIngredient(item.ingredient);
    if (ingredient === undefined) throw new Error(item.ingredient);
    return {
      ingredientId: item.ingredient,
      qty: item.qty,
      unit: item.unit,
      ...(ingredient.grams_per_piece === undefined
        ? {}
        : { gramsPerPiece: ingredient.grams_per_piece }),
      price: {
        status: 'available',
        unitPriceIdr: ingredient.demo_price_idr,
        priceUnit: ingredient.price_unit,
      },
      outlook: { status: 'not_modeled' },
    };
  });
}

describe('catalog', () => {
  it('is versioned', () => {
    expect(CATALOG_VERSION).toMatch(/^catalog-\d+\.\d+\.\d+$/);
  });

  it('has exactly the 3 model commodities as supported ingredients (D-19)', () => {
    expect(modelCommodities()).toEqual(['cabai-merah-keriting', 'bawang-merah', 'beras-medium-1']);
    const supported = listIngredients().filter((item) => item.support_status === 'supported');
    expect(supported.map((item) => item.slug).sort()).toEqual([...modelCommodities()].sort());
  });

  it('lists supported ingredients first', () => {
    const statuses = listIngredients().map((item) => item.support_status);
    expect(statuses.slice(0, 3)).toEqual(['supported', 'supported', 'supported']);
    expect(statuses.slice(3).every((status) => status === 'coming_soon')).toBe(true);
  });

  it('offers 3 menu templates for each of the 3 warung types (F1-Q2)', () => {
    expect(listWarungTypes().map((type) => type.slug)).toEqual(['warteg', 'padang', 'geprek']);
    for (const type of listWarungTypes()) {
      expect(listTemplates(type.slug)).toHaveLength(3);
    }
    expect(listTemplates()).toHaveLength(9);
  });

  it('every template computes with packages/domain', () => {
    for (const template of listTemplates()) {
      const result = calculateMenuCost({
        lines: demoLines(template),
        portionsPerDay: template.portions_per_day,
        sellPriceIdr: template.sell_price_idr,
      });
      expect(result.ok, template.slug).toBe(true);
    }
  });

  it('keeps the official DATA DEMO example: Ayam Geprek = Rp 10.850 (docs 05 §4)', () => {
    const template = getTemplate('ayam-geprek-nasi');
    expect(template).toBeDefined();
    if (template === undefined) return;
    const result = calculateMenuCost({ lines: demoLines(template), portionsPerDay: 100 });
    expect(result.ok && result.value.perPortionTodayIdr).toBe(10_850);
  });

  it('returns undefined for unknown slugs', () => {
    expect(getIngredient('kopi')).toBeUndefined();
    expect(getTemplate('soto')).toBeUndefined();
  });
});
