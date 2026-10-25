'use client';

import { DemoBadge, MovementBadge } from '@kawan-pasar/ui';
import { Link } from 'react-aria-components';

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
      <dt className="text-xs text-text-secondary">{label}</dt>
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
    <article className="flex flex-col gap-3 rounded-lg border border-border-default bg-bg-surface p-4">
      <div className="flex items-start justify-between gap-2">
        <div>
          <h3 className="font-semibold text-text-primary">{name}</h3>
          <p className="text-xs text-text-muted">{portionsPerDay} porsi/hari</p>
        </div>
        {isDemo ? <DemoBadge /> : null}
      </div>
      <dl className="grid grid-cols-2 gap-3">
        <Figure label="Modal per porsi hari ini">
          <span className="font-mono text-xl font-semibold">{view.todayPerPortion ?? '—'}</span>
        </Figure>
        <Figure label="Perkiraan 7 hari">
          <span className="font-mono text-xl font-semibold text-text-brand">
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
      <div className="flex flex-wrap items-center justify-between gap-2 border-t border-border-default pt-3 text-sm">
        <span className="text-text-secondary">
          {view.riskName === null
            ? 'Belum ada bahan berharga'
            : `${view.riskName} = ${String(view.riskShare)} modal porsi`}
        </span>
        <Link
          href={`/rencana/${id}`}
          className="rounded-md px-2 py-1 font-medium text-text-brand outline-none data-[focus-visible]:outline-2 data-[focus-visible]:outline-border-focus data-[hovered]:underline"
        >
          Rincian →
        </Link>
      </div>
    </article>
  );
}
