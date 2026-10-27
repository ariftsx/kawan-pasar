'use client';

// Beranda (docs 09 §5.1): public until this device has a warung, personal after that. The public
// version is server-rendered and passed in, so it works before IndexedDB is read.
import { ButtonLink, DemoBadge, MetricCard, MovementBadge } from '@kawan-pasar/ui';
import { useState } from 'react';

import { Bakul } from '@/components/mascot/bakul';
import { ForecastTrustCard } from '@/features/outlook/forecast-trust-card';
import { CoverageNote } from '@/features/planning/components/coverage-note';
import { MenuCostCard } from '@/features/planning/components/menu-cost-card';
import { usePlan } from '@/features/planning/use-plan';
import { formatChange } from '@/lib/format';
import { ingredientName, percentOf, rupiahOrNull } from '@/lib/planning/view';

import type { CostedMenu } from '@/features/planning/components/menu-table';
import type { PlanSummary } from '@/lib/planning/plan';
import type { ReactNode } from 'react';

const TODAY = new Intl.DateTimeFormat('id-ID', {
  weekday: 'long',
  day: 'numeric',
  month: 'long',
  year: 'numeric',
  timeZone: 'Asia/Jakarta',
});

/** The ingredient expected to add the most rupiah; falls back to the biggest share of cost. */
function watchOut(costed: readonly CostedMenu[], summary: PlanSummary): string | null {
  const rising = costed
    .flatMap(({ cost }) => cost?.items ?? [])
    .flatMap((item) =>
      item.costTodayIdr === null || item.costOutlookIdr === null
        ? []
        : [{ id: item.ingredientId, delta: item.costOutlookIdr - item.costTodayIdr }],
    )
    .sort((a, b) => b.delta - a.delta)[0];
  const slug =
    rising !== undefined && rising.delta > 0 ? rising.id : summary.shares[0]?.ingredientId;
  return slug === undefined ? null : ingredientName(slug);
}

function OutlookCaption({ deltaRatio }: { readonly deltaRatio: number | null }) {
  if (deltaRatio === null) return 'Modal tetap dihitung dengan harga hari ini.';
  return (
    <span className="flex items-center gap-2">
      <MovementBadge change={deltaRatio} label={formatChange(deltaRatio)} />
      estimasi · dalam pengembangan
    </span>
  );
}

function HomeMetrics({ plan }: { readonly plan: ReturnType<typeof usePlan> }) {
  const { summary, costed, isDemo, hasOutlook, outlook } = plan;
  const top = summary.shares[0];
  return (
    <section aria-label="Ringkasan modal" className="grid gap-3 md:grid-cols-3">
      <MetricCard
        label="Modal bahan hari ini"
        value={rupiahOrNull(summary.perDayTodayIdr)}
        caption={
          summary.isPartial
            ? `per hari · dari ${String(summary.itemsPriced)} bahan yang dipantau`
            : 'per hari, semua menu'
        }
        badge={isDemo ? <DemoBadge /> : null}
      />
      <MetricCard
        label="Perkiraan 7 hari lagi"
        tone="brand"
        value={hasOutlook ? rupiahOrNull(summary.perDayOutlookIdr) : null}
        emptyLabel="Perkiraan belum tersedia"
        caption={<OutlookCaption deltaRatio={hasOutlook ? summary.deltaRatio : null} />}
        badge={outlook.status === 'ready' && outlook.isDemo ? <DemoBadge /> : null}
      />
      <MetricCard
        label="Perlu diwaspadai"
        valueKind="text"
        value={watchOut(costed, summary)}
        emptyLabel="Belum ada bahan berharga"
        caption={
          top === undefined
            ? ''
            : `${ingredientName(top.ingredientId)}: ${percentOf(top.shareRatio)} dari modal harian`
        }
      />
    </section>
  );
}

function MenuGrid({ plan }: { readonly plan: ReturnType<typeof usePlan> }) {
  return (
    <section aria-labelledby="menus-title" className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 id="menus-title" className="text-2xl font-bold">
          Menu Anda
        </h2>
        <div className="flex flex-wrap gap-2">
          <ButtonLink href="/rencana" variant="secondary" size="sm">
            Rencana Menu
          </ButtonLink>
          <ButtonLink href="/atur-warung" variant="ghost" size="sm">
            Tambah menu
          </ButtonLink>
        </div>
      </div>
      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
        {plan.costed.map(({ menu, cost }) => (
          <MenuCostCard
            key={menu.id}
            id={menu.id}
            name={menu.name}
            portionsPerDay={menu.portions_per_day}
            cost={cost}
            isDemo={plan.isDemo}
            hasOutlook={plan.hasOutlook}
          />
        ))}
      </div>
    </section>
  );
}

export function HomeScreen({ publicHome }: { readonly publicHome: ReactNode }) {
  const plan = usePlan();
  const [today] = useState(() => TODAY.format(new Date()));
  const { state, summary } = plan;
  if (state.status !== 'ready' || state.warung === null || state.menus.length === 0) {
    return publicHome;
  }
  return (
    <div className="flex flex-col gap-6">
      <header className="flex items-end justify-between gap-4">
        <div className="flex flex-col gap-1">
          <p className="text-base text-text-secondary">{today}</p>
          <h1 className="text-3xl font-bold">Ringkasan dapur hari ini</h1>
          <p className="text-lg text-text-secondary">
            {summary.menuCount} menu, {summary.portionsPerDay} porsi sehari. Harga dari Pasar
            Kramatjati.
          </p>
        </div>
        <Bakul pose="happy" className="hidden w-28 shrink-0 md:block" />
      </header>
      <HomeMetrics plan={plan} />
      <CoverageNote
        priced={summary.itemsPriced}
        total={summary.itemsTotal}
        missing={summary.missingIngredients}
      />
      <MenuGrid plan={plan} />
      <ForecastTrustCard outlook={plan.outlook} />
      <p className="text-sm text-text-secondary">
        Data tersimpan di HP ini. Konteks iklim, berita, dan logistik akan tersedia di halaman
        Konteks.
      </p>
    </div>
  );
}
