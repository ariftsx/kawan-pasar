'use client';

import { getIngredient } from '@kawan-pasar/catalog';
import { DataStatus, MovementBadge } from '@kawan-pasar/ui';

import { formatChange, formatRupiah } from '@/lib/format';

import type { RecipeItem } from '@kawan-pasar/catalog';
import type { CostLine } from '@kawan-pasar/domain';

const UNIT_LABEL: ReadonlyMap<string, string> = new Map([
  ['kg', 'kg'],
  ['l', 'liter'],
  ['butir', 'butir'],
]);

/** "Harga sedang disiapkan" (not supported yet) differs from "Harga belum tersedia" (no data). */
function CostCell({ line }: { readonly line: CostLine | undefined }) {
  if (line?.costTodayIdr != null) return formatRupiah(line.costTodayIdr);
  if (line?.priceStatus === 'coming_soon') return <DataStatus state="coming_soon" />;
  return <DataStatus state="missing" label="Harga belum tersedia" />;
}

function ForecastCell({
  hasPrice,
  predictedChange,
}: {
  readonly hasPrice: boolean;
  readonly predictedChange: number | null;
}) {
  if (!hasPrice) return <span className="text-xs text-text-muted">—</span>;
  if (predictedChange === null) {
    return <span className="text-xs text-text-muted">tanpa perkiraan</span>;
  }
  return <MovementBadge change={predictedChange} label={formatChange(predictedChange)} />;
}

/**
 * IngredientRow (docs 10 §7.3). A price that is not there yet is shown in words with a dash,
 * never Rp 0; an ingredient with a price but no model is "tanpa perkiraan".
 */
export function IngredientRow({
  item,
  line,
  unitPriceIdr,
  predictedChange,
}: {
  readonly item: RecipeItem;
  readonly line: CostLine | undefined;
  readonly unitPriceIdr: number | null;
  readonly predictedChange: number | null;
}) {
  const ingredient = getIngredient(item.ingredient);
  const priceUnit = UNIT_LABEL.get(ingredient?.price_unit ?? '') ?? '';
  const unitPrice = unitPriceIdr === null ? '' : ` · ${formatRupiah(unitPriceIdr)}/${priceUnit}`;
  return (
    <tr className="border-b border-border-default align-top last:border-b-0">
      <th scope="row" className="py-3 pr-3 text-left font-medium text-text-primary">
        {ingredient?.name ?? item.ingredient}
        {ingredient?.commodity == null ? null : <span className="text-text-brand"> ★</span>}
        <span className="block text-xs font-normal text-text-muted">
          {item.qty} {item.unit}
          {unitPrice}
        </span>
      </th>
      <td className="py-3 pr-3 text-right font-mono">
        <CostCell line={line} />
      </td>
      <td className="py-3 text-right">
        <ForecastCell hasPrice={line?.costTodayIdr != null} predictedChange={predictedChange} />
      </td>
    </tr>
  );
}
