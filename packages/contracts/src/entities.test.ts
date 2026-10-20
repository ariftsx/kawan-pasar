import { describe, expect, it } from 'vitest';

import { MenuWithCost } from './cost.js';
import {
  ALERT_EVENT,
  FORECAST,
  MENU_WITH_COST,
  MOVEMENT_THRESHOLD,
  PRICE_OBSERVATION,
} from './entity-examples.fixture.js';
import { AlertEvent, Forecast, MovementThreshold, PriceObservation } from './market.js';

import type { z } from 'zod';

function messages(result: { success: boolean; error?: z.ZodError }): string[] {
  return result.error?.issues.map((issue) => issue.message) ?? [];
}

describe('docs 08 §5 examples parse', () => {
  it.each([
    ['price observation §5.1', PriceObservation, PRICE_OBSERVATION],
    ['menu cost §5.2', MenuWithCost, MENU_WITH_COST],
    ['forecast §5.3', Forecast, FORECAST],
    ['movement threshold §5.4', MovementThreshold, MOVEMENT_THRESHOLD],
    ['alert event §5.5', AlertEvent, ALERT_EVENT],
  ] as const)('%s', (_, schema, example) => {
    expect(schema.safeParse(example).success).toBe(true);
  });

  it('accepts an insufficient-coverage threshold with null values', () => {
    const insufficient = {
      ...MOVEMENT_THRESHOLD,
      status: 'insufficient_coverage',
      q95_abs_change: null,
      window_end: null,
      n_obs: 93,
    };
    expect(MovementThreshold.safeParse(insufficient).success).toBe(true);
  });

  it('rejects a price observation without a positive price', () => {
    expect(PriceObservation.safeParse({ ...PRICE_OBSERVATION, price_idr: 0 }).success).toBe(false);
  });
});

describe('menu cost invariants', () => {
  const withCost = (patch: Record<string, unknown>) => ({
    ...MENU_WITH_COST,
    cost: { ...MENU_WITH_COST.cost, ...patch },
  });
  const [cabai, bawang, beras, ayam, minyak] = MENU_WITH_COST.cost.items;

  it('rejects Rp 0 for an ingredient without a price', () => {
    const items = [cabai, bawang, beras, { ...ayam, cost_today_idr: 0 }, minyak];
    expect(messages(MenuWithCost.safeParse(withCost({ items })))).toContain(
      'Bahan tanpa harga wajib bernilai null, bukan angka.',
    );
  });

  it('rejects a margin on a partial cost', () => {
    expect(messages(MenuWithCost.safeParse(withCost({ margin_today_idr: 11_174 })))).toContain(
      'Margin wajib null saat modal parsial.',
    );
  });

  it('rejects coverage or completeness that disagree with the items', () => {
    const coverage = { ...MENU_WITH_COST.cost.coverage, items_priced: 5 };
    expect(messages(MenuWithCost.safeParse(withCost({ coverage })))).toContain(
      'coverage tidak cocok dengan items.',
    );
    expect(messages(MenuWithCost.safeParse(withCost({ completeness: 'complete' })))).toContain(
      'completeness harus partial.',
    );
  });

  it('accepts a complete cost with margins', () => {
    const cost = withCost({
      items: [cabai, bawang, beras],
      completeness: 'complete',
      coverage: { items_total: 3, items_priced: 3, missing_ingredients: [] },
      margin_today_idr: 11_174,
      margin_outlook_idr: 11_108,
    });
    expect(MenuWithCost.safeParse(cost).success).toBe(true);
  });

  it('rejects unknown fields (strict objects)', () => {
    expect(MenuWithCost.safeParse({ ...MENU_WITH_COST, extra: true }).success).toBe(false);
  });
});
