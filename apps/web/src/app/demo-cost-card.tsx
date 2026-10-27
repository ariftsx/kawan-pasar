import { calculateMenuCost, type RecipeLine } from '@kawan-pasar/domain';
import { DemoBadge, MovementBadge } from '@kawan-pasar/ui';

import { Spot } from '@/components/illustrations';
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
      className="flex flex-col gap-4 rounded-xl border-2 border-border-default bg-bg-surface p-5 md:flex-row md:items-center md:gap-8 md:p-6"
    >
      <Spot name="piring" className="w-28 self-center md:w-40" />
      <div className="flex flex-1 flex-col gap-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h3 id="demo-cost-title" className="text-xl font-bold">
            Ayam Geprek + Nasi
          </h3>
          <DemoBadge />
        </div>
        <dl className="grid gap-4 md:grid-cols-2">
          <div className="flex flex-col gap-1">
            <dt className="text-base text-text-secondary">Modal satu porsi hari ini</dt>
            <dd className="text-3xl font-bold tabular-nums">
              {formatRupiah(cost.perPortionTodayIdr)}
            </dd>
          </div>
          <div className="flex flex-col gap-1">
            <dt className="text-base text-text-secondary">Perkiraan 7 hari lagi</dt>
            <dd className="flex flex-wrap items-center gap-2">
              <span className="text-3xl font-bold text-text-brand tabular-nums">
                {formatRupiah(cost.perPortionOutlookIdr)}
              </span>
              {cost.deltaRatio === null ? null : (
                <MovementBadge change={cost.deltaRatio} label={formatChange(cost.deltaRatio)} />
              )}
            </dd>
          </div>
        </dl>
        <p className="text-sm text-text-secondary">
          Contoh, bukan harga sungguhan. Harga per {formatMarketDate('2026-10-14')}, 100 porsi
          sehari. Perkiraan masih dalam pengembangan.
        </p>
      </div>
    </section>
  );
}
