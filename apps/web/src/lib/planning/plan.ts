// Turns stored menus into packages/domain inputs and summarises a whole plan. All arithmetic stays
// in packages/domain (PLAN-08); this module only decides which price and outlook each line uses.
import { getIngredient, type Ingredient, type RecipeItem } from '@kawan-pasar/catalog';
import {
  calculateMenuCost,
  type IngredientOutlook,
  type IngredientPrice,
  type MenuCost,
  type RecipeLine,
} from '@kawan-pasar/domain';

import type { PublicEnv } from '@/lib/env/public';

export type DataMode = PublicEnv['NEXT_PUBLIC_DATA_MODE'];

/** 7-day outlook per model commodity, as served by /bff/outlook (docs 08 §12.5). */
export type OutlookEntry = {
  readonly status: 'available' | 'candidate' | 'stale' | 'in_development';
  readonly predictedChange: number;
};
export type OutlookMap = ReadonlyMap<string, OutlookEntry>;

/**
 * Demo mode prices every ingredient with its labelled sample price (F1-Q4). Live mode has no
 * daily prices until F2 ingests them: model commodities are `missing`, the rest `coming_soon`.
 */
export function priceFor(ingredient: Ingredient, mode: DataMode): IngredientPrice {
  if (mode === 'demo') {
    return {
      status: 'available',
      unitPriceIdr: ingredient.demo_price_idr,
      priceUnit: ingredient.price_unit,
    };
  }
  return { status: ingredient.support_status === 'supported' ? 'missing' : 'coming_soon' };
}

/** Only model commodities can have a forecast; everything else is "tanpa perkiraan". */
export function outlookFor(ingredient: Ingredient, outlooks: OutlookMap): IngredientOutlook {
  if (ingredient.commodity === null) return { status: 'not_modeled' };
  return outlooks.get(ingredient.commodity) ?? { status: 'missing' };
}

export function buildRecipeLines(
  recipe: readonly RecipeItem[],
  mode: DataMode,
  outlooks: OutlookMap,
): RecipeLine[] {
  return recipe.flatMap((item) => {
    const ingredient = getIngredient(item.ingredient);
    if (ingredient === undefined) return [];
    return [
      {
        ingredientId: item.ingredient,
        qty: item.qty,
        unit: item.unit,
        ...(ingredient.grams_per_piece === undefined
          ? {}
          : { gramsPerPiece: ingredient.grams_per_piece }),
        price: priceFor(ingredient, mode),
        outlook: outlookFor(ingredient, outlooks),
      },
    ];
  });
}

export type MenuInput = {
  readonly recipe: readonly RecipeItem[];
  readonly portions_per_day: number;
  readonly sell_price_idr: number | null;
};

export function costMenu(menu: MenuInput, mode: DataMode, outlooks: OutlookMap): MenuCost | null {
  const result = calculateMenuCost({
    lines: buildRecipeLines(menu.recipe, mode, outlooks),
    portionsPerDay: menu.portions_per_day,
    ...(menu.sell_price_idr === null ? {} : { sellPriceIdr: menu.sell_price_idr }),
  });
  return result.ok ? result.value : null;
}

/**
 * The ingredient that moves the cost most: largest expected increase in rupiah, or the largest
 * share of today's cost when nothing is forecast to rise. It describes; it never advises.
 */
export function riskiestIngredient(
  cost: MenuCost,
): { ingredientId: string; shareRatio: number; deltaIdr: number } | null {
  const priced = cost.items.flatMap((item) =>
    item.costTodayIdr === null || item.shareRatio === null
      ? []
      : [
          {
            ingredientId: item.ingredientId,
            shareRatio: item.shareRatio,
            deltaIdr: (item.costOutlookIdr ?? item.costTodayIdr) - item.costTodayIdr,
          },
        ],
  );
  const [first, ...rest] = priced;
  if (first === undefined) return null;
  return rest.reduce(
    (best, item) =>
      item.deltaIdr > best.deltaIdr ||
      (item.deltaIdr === best.deltaIdr && item.shareRatio > best.shareRatio)
        ? item
        : best,
    first,
  );
}

export type PlanSummary = {
  readonly menuCount: number;
  readonly portionsPerDay: number;
  readonly perDayTodayIdr: number | null;
  readonly perDayOutlookIdr: number | null;
  readonly deltaRatio: number | null;
  readonly isPartial: boolean;
  /** Ingredients without a price anywhere in the plan, for the coverage note. */
  readonly missingIngredients: readonly string[];
  readonly itemsTotal: number;
  readonly itemsPriced: number;
  /** Today's cost per day by ingredient across all menus, largest first. */
  readonly shares: readonly { ingredientId: string; perDayIdr: number; shareRatio: number }[];
};

/** Sum of the known values; `null` when none is known, never 0 (UX-04). */
function sumKnown(values: readonly (number | null)[]): number | null {
  const known = values.filter((value): value is number => value !== null);
  return known.length === 0 ? null : known.reduce((a, b) => a + b, 0);
}

function changeRatio(today: number | null, outlook: number | null): number | null {
  return today === null || outlook === null || today === 0 ? null : outlook / today - 1;
}

export function summarisePlan(
  menus: readonly { readonly cost: MenuCost | null; readonly portions_per_day: number }[],
): PlanSummary {
  const costs = menus.flatMap((menu) =>
    menu.cost === null ? [] : [{ cost: menu.cost, portions: menu.portions_per_day }],
  );
  const perDayTodayIdr = sumKnown(costs.map(({ cost }) => cost.perDayTodayIdr));
  const perDayOutlookIdr = sumKnown(costs.map(({ cost }) => cost.perDayOutlookIdr));

  const byIngredient = new Map<string, number>();
  for (const { cost, portions } of costs) {
    for (const item of cost.items) {
      if (item.costTodayIdr === null) continue;
      byIngredient.set(
        item.ingredientId,
        (byIngredient.get(item.ingredientId) ?? 0) + item.costTodayIdr * portions,
      );
    }
  }
  const total = perDayTodayIdr ?? 0;
  const shares = [...byIngredient]
    .map(([ingredientId, perDayIdr]) => ({
      ingredientId,
      perDayIdr,
      shareRatio: total > 0 ? perDayIdr / total : 0,
    }))
    .sort((a, b) => b.perDayIdr - a.perDayIdr);

  const missing = new Set(costs.flatMap(({ cost }) => cost.coverage.missingIngredients));
  return {
    menuCount: menus.length,
    portionsPerDay: menus.reduce((sum, menu) => sum + menu.portions_per_day, 0),
    perDayTodayIdr,
    perDayOutlookIdr,
    deltaRatio: changeRatio(perDayTodayIdr, perDayOutlookIdr),
    isPartial: costs.some(({ cost }) => cost.completeness === 'partial'),
    missingIngredients: [...missing],
    itemsTotal: costs.reduce((sum, { cost }) => sum + cost.coverage.itemsTotal, 0),
    itemsPriced: costs.reduce((sum, { cost }) => sum + cost.coverage.itemsPriced, 0),
    shares,
  };
}

/** Human list for coverage notes: "ayam, minyak, dan telur". */
export function ingredientNames(slugs: readonly string[]): string {
  const names = slugs.map((slug) => (getIngredient(slug)?.name ?? slug).toLowerCase());
  if (names.length <= 1) return names.join('');
  return `${names.slice(0, -1).join(', ')} dan ${names.at(-1) ?? ''}`;
}
