import { cn } from '../cn.js';

import type { ReactNode } from 'react';

export type MetricCardProps = {
  readonly label: string;
  /** Already formatted, e.g. "Rp 10.850"; `null` shows a dash with `emptyLabel`. */
  readonly value: string | null;
  readonly caption?: ReactNode;
  readonly badge?: ReactNode;
  readonly emptyLabel?: string;
  readonly tone?: 'default' | 'brand';
  /** `text` for names (sans, smaller); numbers stay mono and tabular. */
  readonly valueKind?: 'number' | 'text';
  readonly className?: string;
};

/** A decision number (docs 10 §7.2): label, big mono value, and a caption with date or status. */
export function MetricCard({
  label,
  value,
  caption,
  badge,
  emptyLabel = 'Belum tersedia',
  tone = 'default',
  valueKind = 'number',
  className,
}: MetricCardProps) {
  return (
    <div
      className={cn(
        'flex flex-col gap-1 rounded-lg border border-border-default bg-bg-surface p-4',
        className,
      )}
    >
      <div className="flex items-start justify-between gap-2">
        <p className="text-sm text-text-secondary">{label}</p>
        {badge}
      </div>
      {value === null ? (
        <p className="text-base text-text-muted">
          <span aria-hidden="true">— </span>
          {emptyLabel}
        </p>
      ) : (
        <p
          className={cn(
            valueKind === 'number'
              ? 'font-mono text-2xl font-semibold tabular-nums md:text-3xl'
              : 'text-xl font-semibold md:text-2xl',
            tone === 'brand' ? 'text-text-brand' : 'text-text-primary',
          )}
        >
          {value}
        </p>
      )}
      {caption === undefined ? null : <div className="text-xs text-text-muted">{caption}</div>}
    </div>
  );
}
