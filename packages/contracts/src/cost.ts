// Menu and menu cost (docs 08 §5.2). The wire shape keeps every field present and uses `null`
// for unknown values, so clients never have to guess between "absent" and "zero".
import { z } from 'zod';

import { CostCompleteness, OutlookStatus, QuantityUnit } from './enums.js';
import {
  ChangeRatio,
  MarketDate,
  NullableRupiah,
  Rupiah,
  ShareRatio,
  Slug,
  prefixedId,
} from './primitives.js';

import type { PriceStatus } from './enums.js';

export const Menu = z.strictObject({
  id: prefixedId('mnu'),
  name: z.string().trim().min(1).max(80),
  portions_per_day: z.int().nonnegative().max(100_000),
  sell_price_idr: Rupiah.nullable(),
});

const KnownPrice = z.strictObject({
  status: z.enum(['available', 'stale']),
  unit_price_idr: Rupiah,
  observed_at: MarketDate,
});
const UnknownPrice = z.strictObject({ status: z.enum(['missing', 'coming_soon']) });
export const IngredientPrice = z.union([KnownPrice, UnknownPrice]);

export const CostItemOutlook = z.strictObject({
  status: OutlookStatus,
  predicted_change: ChangeRatio.nullable(),
  cost_idr: NullableRupiah,
});

export const CostItem = z.strictObject({
  ingredient: Slug,
  qty: z.number().positive(),
  unit: QuantityUnit,
  price: IngredientPrice,
  cost_today_idr: NullableRupiah,
  outlook: CostItemOutlook,
  share_ratio: ShareRatio.nullable(),
});

const isPriced = (status: z.infer<typeof PriceStatus>) =>
  status === 'available' || status === 'stale';

export const MenuCost = z
  .strictObject({
    horizon_days: z.int().positive(),
    completeness: CostCompleteness,
    coverage: z.strictObject({
      items_total: z.int().nonnegative(),
      items_priced: z.int().nonnegative(),
      missing_ingredients: z.array(Slug),
    }),
    per_portion_today_idr: NullableRupiah,
    per_portion_outlook_idr: NullableRupiah,
    delta_ratio: z.number().nullable(),
    per_day_today_idr: NullableRupiah,
    per_day_outlook_idr: NullableRupiah,
    items: z.array(CostItem),
    margin_today_idr: z.int().nullable(),
    margin_outlook_idr: z.int().nullable(),
  })
  .superRefine((cost, ctx) => {
    const priced = cost.items.filter((item) => isPriced(item.price.status));
    const issue = (message: string) => {
      ctx.addIssue({ code: 'custom', message, input: cost });
    };
    if (cost.items.some((item) => !isPriced(item.price.status) && item.cost_today_idr !== null)) {
      issue('Bahan tanpa harga wajib bernilai null, bukan angka.');
    }
    if (
      cost.coverage.items_total !== cost.items.length ||
      cost.coverage.items_priced !== priced.length
    ) {
      issue('coverage tidak cocok dengan items.');
    }
    const expected = priced.length === cost.items.length ? 'complete' : 'partial';
    if (cost.completeness !== expected) issue(`completeness harus ${expected}.`);
    if (
      cost.completeness === 'partial' &&
      (cost.margin_today_idr !== null || cost.margin_outlook_idr !== null)
    ) {
      issue('Margin wajib null saat modal parsial.');
    }
  });

export const MenuWithCost = z.strictObject({ menu: Menu, cost: MenuCost });

export type Menu = z.infer<typeof Menu>;
export type MenuCost = z.infer<typeof MenuCost>;
export type CostItem = z.infer<typeof CostItem>;
