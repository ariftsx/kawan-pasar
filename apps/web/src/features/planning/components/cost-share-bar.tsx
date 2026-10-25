'use client';

import { getIngredient } from '@kawan-pasar/catalog';
import { cn } from '@kawan-pasar/ui';

import { formatRupiah } from '@/lib/format';

/** Model ingredients (with ★ outlook) get colour; the rest stay grey (docs 09 §5.2). */
const MODEL_TONES = ['bg-chart-forecast', 'bg-chart-observed', 'bg-chart-origin'] as const;

export type Share = {
  readonly ingredientId: string;
  readonly perDayIdr: number;
  readonly shareRatio: number;
};

/** CostShareBar (docs 10 §7.3): a stacked bar plus a legend that repeats every number as text. */
export function CostShareBar({ shares }: { readonly shares: readonly Share[] }) {
  let modelIndex = 0;
  const rows = shares.map((share) => {
    const isModel = getIngredient(share.ingredientId)?.commodity != null;
    const tone = isModel ? MODEL_TONES[modelIndex++ % MODEL_TONES.length] : 'bg-bg-muted';
    return { ...share, isModel, tone };
  });
  return (
    <figure className="flex flex-col gap-3">
      <div aria-hidden="true" className="flex h-4 w-full overflow-hidden rounded-full bg-bg-subtle">
        {rows.map((row) => (
          <span
            key={row.ingredientId}
            className={cn('h-full border-r border-bg-surface last:border-r-0', row.tone)}
            style={{ width: `${String(row.shareRatio * 100)}%` }}
          />
        ))}
      </div>
      <figcaption className="sr-only">Asal modal per hari menurut bahan</figcaption>
      <ul className="grid gap-1 text-sm sm:grid-cols-2">
        {rows.map((row) => (
          <li key={row.ingredientId} className="flex items-center gap-2">
            <span aria-hidden="true" className={cn('size-3 shrink-0 rounded-sm', row.tone)} />
            <span className="flex-1 text-text-primary">
              {getIngredient(row.ingredientId)?.name ?? row.ingredientId}
              {row.isModel ? <span className="text-text-brand"> ★</span> : null}
            </span>
            <span className="font-mono text-text-secondary">
              {String(Math.round(row.shareRatio * 100))}% · {formatRupiah(row.perDayIdr)}
            </span>
          </li>
        ))}
      </ul>
    </figure>
  );
}
