'use client';

import { DemoBadge, MovementBadge } from '@kawan-pasar/ui';
import { Link } from 'react-aria-components';

import { Icon } from '@/components/icons';
import { formatChange } from '@/lib/format';
import { menuView } from '@/lib/planning/view';

import { CoverageNote } from './coverage-note';

import type { MenuCost } from '@kawan-pasar/domain';
import type { ReactNode } from 'react';

export type MenuCostCardProps = {
  readonly id: string;
  readonly name: string;
  readonly portionsPerDay: number;
  readonly cost: MenuCost | null;
  readonly isDemo: boolean;
  readonly hasOutlook: boolean;
};

function Figure({ label, children }: { readonly label: string; readonly children: ReactNode }) {
  return (
    <div>
      <dt className="text-sm text-text-secondary">{label}</dt>
      <dd className="flex flex-wrap items-center gap-2">{children}</dd>
    </div>
  );
}

/** MenuCostCard (docs 10 §7.3): cost today, the outlook, and the riskiest ingredient. */
export function MenuCostCard({
  id,
  name,
  portionsPerDay,
  cost,
  isDemo,
  hasOutlook,
}: MenuCostCardProps) {
  const view = menuView(cost, hasOutlook);
  return (
    <article className="flex flex-col gap-3 rounded-xl border border-border-default bg-bg-surface p-4">
      <div className="flex items-start justify-between gap-2">
        <div>
          <h3 className="text-xl font-bold text-text-primary">{name}</h3>
          <p className="text-base text-text-secondary">{portionsPerDay} porsi sehari</p>
        </div>
        {isDemo ? <DemoBadge /> : null}
      </div>
      <dl className="grid grid-cols-2 gap-3">
        <Figure label="Modal per porsi hari ini">
          <span className="text-2xl font-bold tabular-nums">{view.todayPerPortion ?? '—'}</span>
        </Figure>
        <Figure label="Perkiraan 7 hari">
          <span className="text-2xl font-bold text-text-brand tabular-nums">
            {view.outlookPerPortion ?? '—'}
          </span>
          {view.deltaRatio === null ? null : (
            <MovementBadge change={view.deltaRatio} label={formatChange(view.deltaRatio)} />
          )}
        </Figure>
      </dl>
      {cost === null ? null : (
        <CoverageNote
          priced={cost.coverage.itemsPriced}
          total={cost.coverage.itemsTotal}
          missing={cost.coverage.missingIngredients}
        />
      )}
      <div className="flex flex-wrap items-center justify-between gap-2 border-t border-border-default pt-3 text-base">
        <span className="text-text-secondary">
          {view.riskName === null
            ? 'Belum ada bahan berharga'
            : `${view.riskName}: ${String(view.riskShare)} dari modal porsi`}
        </span>
        <Link
          href={`/rencana/${id}`}
          className="inline-flex min-h-11 items-center gap-1 rounded-md px-2 font-semibold text-text-brand outline-none data-[focus-visible]:outline-2 data-[focus-visible]:outline-border-focus data-[hovered]:underline"
        >
          Lihat rincian<span className="sr-only"> {name}</span>
          <Icon name="chevron-right" className="size-5" />
        </Link>
      </div>
    </article>
  );
}
