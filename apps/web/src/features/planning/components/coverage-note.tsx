'use client';

import { ingredientNames } from '@/lib/planning/plan';

/** "Dihitung dari 3 dari 5 bahan." Required whenever a cost is partial (docs 09 §7.3). */
export function CoverageNote({
  priced,
  total,
  missing,
}: {
  readonly priced: number;
  readonly total: number;
  readonly missing: readonly string[];
}) {
  if (missing.length === 0) return null;
  return (
    <details className="text-sm text-text-secondary">
      <summary className="cursor-pointer">
        Dihitung dari{' '}
        <strong>
          {priced} dari {total} bahan
        </strong>
        . <span className="text-text-brand underline">Kenapa?</span>
      </summary>
      <p className="mt-1 max-w-prose">
        Kawan Pasar baru memantau harga cabai merah keriting, bawang merah, dan beras medium. Harga{' '}
        {ingredientNames(missing)} sedang kami siapkan. Sementara itu, modal hanya dihitung dari
        bahan yang sudah ada harganya.
      </p>
    </details>
  );
}
