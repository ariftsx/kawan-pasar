// Catalog shapes (docs 05 §3: Ingredient, MenuTemplate). The data is validated at import time,
// so a typo in the seed fails the build instead of reaching a user.
import { PriceUnit, QuantityUnit, Rupiah, Slug } from '@kawan-pasar/contracts';
import { z } from 'zod';

/** `supported` has a daily price (3 model commodities, D-19); the rest wait for DH-01. */
export const SupportStatus = z.enum(['supported', 'coming_soon']);

export const Ingredient = z.strictObject({
  slug: Slug,
  name: z.string().min(1),
  /** Model commodity this ingredient maps to; `null` means "tanpa perkiraan" (AGENTS §3.3). */
  commodity: Slug.nullable(),
  support_status: SupportStatus,
  price_unit: PriceUnit,
  /** Needed when recipes count pieces but the price is per kg (eggs). */
  grams_per_piece: z.number().positive().optional(),
  /** Labelled sample price per `price_unit` for `demo` mode only (F1-Q4). Never a real price. */
  demo_price_idr: Rupiah.positive(),
});

export const WarungType = z.strictObject({
  slug: Slug,
  name: z.string().min(1),
  description: z.string().min(1),
});

export const RecipeItem = z.strictObject({
  ingredient: Slug,
  qty: z.number().positive(),
  unit: QuantityUnit,
});

export const MenuTemplate = z.strictObject({
  slug: Slug,
  warung_type: Slug,
  name: z.string().min(1),
  portions_per_day: z.int().positive(),
  sell_price_idr: Rupiah.positive(),
  recipe: z.array(RecipeItem).min(1),
});

export type SupportStatus = z.infer<typeof SupportStatus>;
export type Ingredient = z.infer<typeof Ingredient>;
export type WarungType = z.infer<typeof WarungType>;
export type RecipeItem = z.infer<typeof RecipeItem>;
export type MenuTemplate = z.infer<typeof MenuTemplate>;
