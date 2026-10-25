'use client';

import { DemoBadge, MetricCard, MovementBadge } from '@kawan-pasar/ui';

import { formatChange, formatRupiah } from '@/lib/format';
import { rupiahOrNull } from '@/lib/planning/view';

import { CoverageNote } from './coverage-note';

import type { PlanSummary as Summary } from '@/lib/planning/plan';

export type PlanSummaryProps = {
  readonly summary: Summary;
  readonly hasOutlook: boolean;
  readonly isDemo: boolean;
  readonly isOutlookDemo: boolean;
};

function OutlookCaption({ deltaRatio }: { readonly deltaRatio: number | null }) {
  if (deltaRatio === null) return 'Estimasi, bukan jaminan';
  return (
    <span className="flex items-center gap-2">
      <MovementBadge change={deltaRatio} label={formatChange(deltaRatio)} />
      estimasi, bukan jaminan
    </span>
  );
}

function weeklyDelta(today: number | null, outlook: number | null): number | null {
  return today === null || outlook === null ? null : (outlook - today) * 7;
}

/** Three decision numbers for the whole plan (docs 09 §5.2), with the coverage note when partial. */
export function PlanSummary({ summary, hasOutlook, isDemo, isOutlookDemo }: PlanSummaryProps) {
  const outlook = hasOutlook ? summary.perDayOutlookIdr : null;
  const weekly = weeklyDelta(summary.perDayTodayIdr, outlook);
  return (
    <>
      <section aria-label="Ringkasan modal" className="grid gap-3 md:grid-cols-3">
        <MetricCard
          label="Modal bahan per hari"
          value={rupiahOrNull(summary.perDayTodayIdr)}
          caption="Harga hari ini"
          badge={isDemo ? <DemoBadge /> : null}
        />
        <MetricCard
          label="Perkiraan 7 hari lagi"
          tone="brand"
          value={rupiahOrNull(outlook)}
          emptyLabel="Perkiraan belum tersedia"
          caption={<OutlookCaption deltaRatio={hasOutlook ? summary.deltaRatio : null} />}
          badge={isOutlookDemo ? <DemoBadge /> : null}
        />
        <MetricCard
          label="Selisih per minggu"
          value={rupiahOrNull(weekly)}
          emptyLabel="Menunggu perkiraan"
          caption={weekly === null ? '' : `${formatRupiah(weekly / 7)} per hari`}
        />
      </section>
      <CoverageNote
        priced={summary.itemsPriced}
        total={summary.itemsTotal}
        missing={summary.missingIngredients}
      />
    </>
  );
}
