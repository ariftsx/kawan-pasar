// Guest-mode records kept on the device (docs 12 §3, ONB-03). Every read is validated, so data
// written by an older version or edited by hand never reaches the cost calculation unchecked.
import { RecipeItem } from '@kawan-pasar/catalog';
import { Rupiah, Slug } from '@kawan-pasar/contracts';
import { z } from 'zod';

/** Bumped with a migration in the repository whenever a stored shape changes. */
export const GUEST_SCHEMA_VERSION = 1;

const MenuId = z.string().regex(/^mnu_[0-9A-HJKMNP-TV-Z]{26}$/);

export const GuestWarung = z.strictObject({
  warung_type: Slug,
  created_at: z.iso.datetime({ offset: true }),
});

export const GuestMenu = z.strictObject({
  id: MenuId,
  name: z.string().trim().min(1).max(60),
  /** The template it started from; `null` for a menu the user built. */
  template: Slug.nullable(),
  portions_per_day: z.int().min(0).max(10_000),
  sell_price_idr: Rupiah.nullable(),
  recipe: z.array(RecipeItem).max(20),
  updated_at: z.iso.datetime({ offset: true }),
});

export const GuestExport = z.strictObject({
  format: z.literal('kawan-pasar-guest-export'),
  schema_version: z.literal(GUEST_SCHEMA_VERSION),
  exported_at: z.iso.datetime({ offset: true }),
  warung: GuestWarung.nullable(),
  menus: z.array(GuestMenu),
});

export type GuestWarung = z.infer<typeof GuestWarung>;
export type GuestMenu = z.infer<typeof GuestMenu>;
export type GuestExport = z.infer<typeof GuestExport>;
