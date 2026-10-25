'use client';

import { Callout, Card, MetricCard, NumberStepper } from '@kawan-pasar/ui';

import { formatRupiah } from '@/lib/format';
import { ingredientNames } from '@/lib/planning/plan';

import type { MenuCost } from '@kawan-pasar/domain';

const RUPIAH_FORMAT = { style: 'currency', currency: 'IDR', maximumFractionDigits: 0 } as const;

function MarginBody({
  cost,
  sellPriceIdr,
  portionsPerDay,
  hasOutlook,
}: {
  readonly cost: MenuCost | null;
  readonly sellPriceIdr: number | null;
  readonly portionsPerDay: number;
  readonly hasOutlook: boolean;
}) {
  // A partial cost makes the margin look better than it is, so it is withheld (PLAN-09).
  if (cost?.completeness === 'partial') {
    return (
      <Callout tone="info" title="Margin belum bisa dihitung">
        Harga {ingredientNames(cost.coverage.missingIngredients)} sedang disiapkan, jadi margin akan
        terlihat lebih besar dari kenyataan.
      </Callout>
    );
  }
  if (sellPriceIdr === null || cost === null) {
    return <p className="text-sm text-text-secondary">Isi harga jual untuk melihat margin.</p>;
  }
  const today = cost.marginTodayIdr;
  const outlook = hasOutlook ? cost.marginOutlookIdr : null;
  return (
    <div className="grid gap-3 md:grid-cols-2">
      <MetricCard
        label="Margin hari ini"
        value={today === null ? null : formatRupiah(today)}
        caption={`${formatRupiah(today === null ? null : today * portionsPerDay)} per hari`}
      />
      <MetricCard
        label="Margin perkiraan 7 hari"
        tone="brand"
        value={outlook === null ? null : formatRupiah(outlook)}
        emptyLabel="Perkiraan belum tersedia"
        caption="Estimasi, bukan jaminan"
      />
    </div>
  );
}

/** Margin card (docs 09 §5.3, PLAN-07): sell price input and the resulting margin. */
export function MarginCard({
  cost,
  sellPriceIdr,
  portionsPerDay,
  hasOutlook,
  onSellPrice,
}: {
  readonly cost: MenuCost | null;
  readonly sellPriceIdr: number | null;
  readonly portionsPerDay: number;
  readonly hasOutlook: boolean;
  readonly onSellPrice: (price: number | null) => void;
}) {
  return (
    <Card aria-labelledby="margin-title" className="flex flex-col gap-4">
      <h2 id="margin-title" className="text-lg font-semibold">
        Margin per porsi
      </h2>
      <NumberStepper
        label="Harga jual per porsi"
        minValue={0}
        maxValue={1_000_000}
        step={500}
        isWide
        value={sellPriceIdr ?? Number.NaN}
        formatOptions={RUPIAH_FORMAT}
        onChange={(price) => {
          onSellPrice(Number.isFinite(price) ? Math.round(price) : null);
        }}
      />
      <MarginBody
        cost={cost}
        sellPriceIdr={sellPriceIdr}
        portionsPerDay={portionsPerDay}
        hasOutlook={hasOutlook}
      />
    </Card>
  );
}
