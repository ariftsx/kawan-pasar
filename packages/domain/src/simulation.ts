/**
 * "What if one ingredient gets more expensive?" — plain arithmetic, labelled in the UI as
 * "hitungan biasa, bukan perkiraan model" (docs 05 §4, PLAN-06).
 *
 * C_sim = C + cost_k × s, applied to today's cost of the chosen ingredient.
 */
import { isNonNegativeSafeInteger, roundRupiah } from './money.js';
import { err, ok, type Result } from './result.js';

import type { MenuCost } from './cost.js';

export type PriceIncreaseSimulation = {
  readonly ingredientId: string;
  readonly increaseRatio: number;
  readonly perPortionIdr: number;
  readonly perDayIdr: number;
  readonly deltaPerPortionIdr: number;
  readonly deltaPerDayIdr: number;
};

/** Slider range in the UI is 0–100%. */
export const MAX_SIMULATED_INCREASE = 1;

export function simulatePriceIncrease(
  cost: MenuCost,
  ingredientId: string,
  increaseRatio: number,
  portionsPerDay: number,
): Result<PriceIncreaseSimulation> {
  if (
    !Number.isFinite(increaseRatio) ||
    increaseRatio < 0 ||
    increaseRatio > MAX_SIMULATED_INCREASE
  ) {
    return err('INVALID_INCREASE', 'Kenaikan simulasi harus di antara 0% dan 100%.');
  }
  if (!isNonNegativeSafeInteger(portionsPerDay)) {
    return err('INVALID_PORTIONS', 'Porsi per hari harus bilangan bulat ≥ 0.');
  }
  const line = cost.items.find((item) => item.ingredientId === ingredientId);
  if (line === undefined) {
    return err('INGREDIENT_NOT_FOUND', `Bahan ${ingredientId} tidak ada di menu ini.`);
  }
  if (line.costTodayIdr === null || cost.perPortionTodayIdr === null) {
    return err('INGREDIENT_NOT_PRICED', `Harga ${ingredientId} belum tersedia untuk simulasi.`);
  }
  const deltaPerPortionIdr = roundRupiah(line.costTodayIdr * increaseRatio);
  const perPortionIdr = cost.perPortionTodayIdr + deltaPerPortionIdr;
  return ok({
    ingredientId,
    increaseRatio,
    perPortionIdr,
    perDayIdr: perPortionIdr * portionsPerDay,
    deltaPerPortionIdr,
    deltaPerDayIdr: deltaPerPortionIdr * portionsPerDay,
  });
}
