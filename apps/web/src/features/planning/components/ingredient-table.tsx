'use client';

import { getIngredient, type RecipeItem } from '@kawan-pasar/catalog';

import { outlookFor, priceFor, type DataMode, type OutlookMap } from '@/lib/planning/plan';

import { CoverageNote } from './coverage-note';
import { IngredientRow } from './ingredient-row';

import type { MenuCost } from '@kawan-pasar/domain';

function rowData(item: RecipeItem, mode: DataMode, outlooks: OutlookMap) {
  const ingredient = getIngredient(item.ingredient);
  if (ingredient === undefined) return { unitPriceIdr: null, predictedChange: null };
  const price = priceFor(ingredient, mode);
  const forecast = outlookFor(ingredient, outlooks);
  return {
    unitPriceIdr: 'unitPriceIdr' in price ? price.unitPriceIdr : null,
    predictedChange: 'predictedChange' in forecast ? forecast.predictedChange : null,
  };
}

/** Ingredients per portion (docs 09 §5.3) with the coverage note when the cost is partial. */
export function IngredientTable({
  recipe,
  cost,
  mode,
  outlooks,
}: {
  readonly recipe: readonly RecipeItem[];
  readonly cost: MenuCost | null;
  readonly mode: DataMode;
  readonly outlooks: OutlookMap;
}) {
  if (recipe.length === 0) {
    return (
      <p className="text-sm text-text-secondary">
        Belum ada bahan. Tambahkan bahan di bawah untuk menghitung modal.
      </p>
    );
  }
  return (
    <>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border-strong text-xs text-text-secondary">
              <th scope="col" className="py-2 pr-3 text-left font-medium">
                Bahan
              </th>
              <th scope="col" className="py-2 pr-3 text-right font-medium">
                Biaya
              </th>
              <th scope="col" className="py-2 text-right font-medium">
                Perkiraan 7 hari
              </th>
            </tr>
          </thead>
          <tbody>
            {recipe.map((item) => (
              <IngredientRow
                key={item.ingredient}
                item={item}
                line={cost?.items.find((line) => line.ingredientId === item.ingredient)}
                {...rowData(item, mode, outlooks)}
              />
            ))}
          </tbody>
        </table>
      </div>
      {cost === null ? null : (
        <CoverageNote
          priced={cost.coverage.itemsPriced}
          total={cost.coverage.itemsTotal}
          missing={cost.coverage.missingIngredients}
        />
      )}
    </>
  );
}
