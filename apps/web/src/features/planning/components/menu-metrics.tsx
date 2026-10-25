'use client';

import { DemoBadge, MetricCard } from '@kawan-pasar/ui';

import { menuView } from '@/lib/planning/view';

import type { MenuCost } from '@kawan-pasar/domain';

/** Per-portion decision numbers for one menu (docs 09 §5.3). */
export function MenuMetrics({
  cost,
  hasOutlook,
  isDemo,
  isOutlookDemo,
}: {
  readonly cost: MenuCost | null;
  readonly hasOutlook: boolean;
  readonly isDemo: boolean;
  readonly isOutlookDemo: boolean;
}) {
  const view = menuView(cost, hasOutlook);
  return (
    <section aria-label="Modal per porsi" className="grid gap-3 md:grid-cols-3">
      <MetricCard
        label="Modal per porsi hari ini"
        value={view.todayPerPortion}
        caption={`${view.todayPerDay ?? '—'} per hari`}
        badge={isDemo ? <DemoBadge /> : null}
      />
      <MetricCard
        label="Perkiraan 7 hari lagi"
        tone="brand"
        value={view.outlookPerPortion}
        emptyLabel="Perkiraan belum tersedia"
        caption="Estimasi, bukan jaminan"
        badge={isOutlookDemo ? <DemoBadge /> : null}
      />
      <MetricCard
        label="Bahan paling berisiko"
        valueKind="text"
        value={view.riskName}
        emptyLabel="Belum ada bahan berharga"
        caption={view.riskShare === null ? '' : `${view.riskShare} modal porsi`}
      />
    </section>
  );
}
