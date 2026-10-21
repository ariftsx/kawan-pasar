import { calculateMenuCost, type RecipeLine } from '@kawan-pasar/domain';

import { formatChange, formatMarketDate, formatRupiah } from '@/lib/format';

// DATA DEMO card from the interview stimulus (docs 05 §4): Rp 10.850 → Rp 10.914.
const DEMO_LINES: readonly RecipeLine[] = [
  demoLine('beras-medium-1', 120, 'g', 13_650, 0),
  demoLine('daging-ayam-ras', 150, 'g', 36_667, null),
  demoLine('minyak-goreng', 15, 'ml', 40_000, null),
  demoLine('cabai-merah-keriting', 40, 'g', 52_400, 0.028),
  demoLine('bawang-merah', 15, 'g', 38_933, 0.009),
  demoLine('bumbu-lain', 12, 'g', 36_000, null),
];

/** Prices are per kg, or per litre for millilitre quantities. */
function demoLine(
  ingredientId: string,
  qty: number,
  unit: 'g' | 'ml',
  unitPriceIdr: number,
  change: number | null,
): RecipeLine {
  return {
    ingredientId,
    qty,
    unit,
    price: { status: 'available', unitPriceIdr, priceUnit: unit === 'ml' ? 'l' : 'kg' },
    outlook:
      change === null
        ? { status: 'not_modeled' }
        : { status: 'in_development', predictedChange: change },
  };
}

export function DemoCostCard() {
  const result = calculateMenuCost({ lines: DEMO_LINES, portionsPerDay: 100 });
  if (!result.ok) return <p role="alert">{result.error.message}</p>;
  const cost = result.value;

  return (
    <section
      aria-labelledby="demo-cost-title"
      className="bg-bg-surface border-border-default rounded-lg border p-6 shadow-1"
    >
      <div className="flex items-center justify-between gap-4">
        <h2 id="demo-cost-title" className="text-lg font-semibold">
          Ayam Geprek + Nasi
        </h2>
        <span className="bg-demo-bg text-demo-fg rounded-sm px-2 py-0.5 text-xs font-semibold">
          DATA DEMO
        </span>
      </div>
      <dl className="mt-4 grid grid-cols-2 gap-4 font-mono">
        <div>
          <dt className="text-text-muted font-sans text-xs">Modal per porsi hari ini</dt>
          <dd className="text-2xl">{formatRupiah(cost.perPortionTodayIdr)}</dd>
        </div>
        <div>
          <dt className="text-text-muted font-sans text-xs">Perkiraan 7 hari lagi</dt>
          <dd className="text-text-brand text-2xl">{formatRupiah(cost.perPortionOutlookIdr)}</dd>
          <dd className="text-status-up-fg text-sm">{formatChange(cost.deltaRatio)}</dd>
        </div>
      </dl>
      <p className="text-text-muted mt-4 text-xs">
        Contoh fiktif per {formatMarketDate('2026-10-14')} · 100 porsi/hari · perkiraan masih dalam
        pengembangan.
      </p>
    </section>
  );
}
