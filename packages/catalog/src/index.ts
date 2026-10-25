// Read-only access to the validated catalog. The data is parsed once at import time, so a
// broken seed fails the build and the tests, never a user session.
import { z } from 'zod';

import { CATALOG_VERSION, INGREDIENTS, MENU_TEMPLATES, WARUNG_TYPES } from './data.js';
import { Ingredient, MenuTemplate, WarungType } from './schema.js';

export * from './schema.js';
export { CATALOG_VERSION };

function parseCatalog() {
  const ingredients = z.array(Ingredient).parse(INGREDIENTS);
  const warungTypes = z.array(WarungType).parse(WARUNG_TYPES);
  const templates = z.array(MenuTemplate).parse(MENU_TEMPLATES);
  const known = new Set(ingredients.map((item) => item.slug));
  const types = new Set(warungTypes.map((type) => type.slug));
  for (const template of templates) {
    if (!types.has(template.warung_type)) {
      throw new Error(`${template.slug}: jenis warung ${template.warung_type} tidak dikenal`);
    }
    const unknown = template.recipe.find((item) => !known.has(item.ingredient));
    if (unknown !== undefined) {
      throw new Error(`${template.slug}: bahan ${unknown.ingredient} tidak ada di katalog`);
    }
  }
  return { ingredients, warungTypes, templates };
}

const catalog = parseCatalog();
const bySlug = new Map(catalog.ingredients.map((item) => [item.slug, item]));

/** Supported ingredients first, as the ingredient picker requires (docs 09 §7.3). */
export function listIngredients(): readonly Ingredient[] {
  return [...catalog.ingredients].sort(
    (a, b) =>
      Number(b.support_status === 'supported') - Number(a.support_status === 'supported') ||
      a.name.localeCompare(b.name, 'id'),
  );
}

export function getIngredient(slug: string): Ingredient | undefined {
  return bySlug.get(slug);
}

export function listWarungTypes(): readonly WarungType[] {
  return catalog.warungTypes;
}

export function listTemplates(warungType?: string): readonly MenuTemplate[] {
  return warungType === undefined
    ? catalog.templates
    : catalog.templates.filter((template) => template.warung_type === warungType);
}

export function getTemplate(slug: string): MenuTemplate | undefined {
  return catalog.templates.find((template) => template.slug === slug);
}

/** The model commodities that have a daily price and an Outlook (docs 08 §4.1). */
export function modelCommodities(): readonly string[] {
  return catalog.ingredients.flatMap((item) => (item.commodity === null ? [] : [item.commodity]));
}
