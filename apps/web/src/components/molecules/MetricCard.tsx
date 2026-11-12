import type { ReactNode } from 'react';

/** Small labelled figure (v0.4 MetricCard), e.g. "HARGA ACUAN · Rp 52.400 · harga pada hari dasar". */
export function MetricCard({
  label,
  value,
  caption,
}: {
  label: string;
  value: ReactNode;
  caption: string;
}): ReactNode {
  return (
    <div className="flex min-w-0 flex-col gap-1.5 rounded-lg border border-line bg-surface p-5">
      <p className="text-overline-11 text-muted-text uppercase">{label}</p>
      {value}
      <p className="text-body-small-13 text-ink-2">{caption}</p>
    </div>
  );
}
