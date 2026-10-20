// Shared recipe fixtures for tests. Mirrors the official examples in docs 05 §4 and docs 08 §5.2.
import type { IngredientOutlook, IngredientPrice, RecipeLine } from './cost.js';
import type { PriceUnit, QuantityUnit } from './units.js';

export function priced(unitPriceIdr: number, priceUnit: PriceUnit = 'kg'): IngredientPrice {
  return { status: 'available', unitPriceIdr, priceUnit };
}

export function forecast(predictedChange: number): IngredientOutlook {
  return { status: 'available', predictedChange };
}

export const NOT_MODELED: IngredientOutlook = { status: 'not_modeled' };
export const COMING_SOON: IngredientPrice = { status: 'coming_soon' };

export function line(
  ingredientId: string,
  qty: number,
  unit: QuantityUnit,
  price: IngredientPrice,
  outlook: IngredientOutlook = NOT_MODELED,
): RecipeLine {
  return { ingredientId, qty, unit, price, outlook };
}

/** Live mode, 3 supported commodities only (docs 08 §5.2): Rp 3.826 → Rp 3.892. */
export const LIVE_AYAM_GEPREK: readonly RecipeLine[] = [
  line('cabai-merah-keriting', 40, 'g', priced(52_400), forecast(0.028)),
  line('bawang-merah', 10, 'g', priced(38_000), forecast(0.01)),
  line('beras-medium-1', 100, 'g', priced(13_500), forecast(0.002)),
  line('daging-ayam-ras', 150, 'g', COMING_SOON),
  line('minyak-goreng', 15, 'ml', COMING_SOON),
];

/**
 * DATA DEMO card (interview stimulus, docs 05 §4): every ingredient has a sample price.
 * beras 1.638 + ayam 5.500 + minyak 600 + cabai 2.096 + bawang 584 + bumbu 432 = Rp 10.850 → 10.914.
 */
export const DEMO_AYAM_GEPREK: readonly RecipeLine[] = [
  line('beras-medium-1', 120, 'g', priced(13_650), forecast(0)),
  line('daging-ayam-ras', 150, 'g', priced(36_667)),
  line('minyak-goreng', 15, 'ml', priced(40_000, 'l')),
  line('cabai-merah-keriting', 40, 'g', priced(52_400), forecast(0.028)),
  line('bawang-merah', 15, 'g', priced(38_933), forecast(0.009)),
  line('bumbu-lain', 12, 'g', priced(36_000)),
];
