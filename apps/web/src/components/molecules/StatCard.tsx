import type { ReactNode } from 'react';

/** Highlight card (v0.4 StatCard): overline, name, big value with a delta, and a note. */
export function StatCard({
  icon,
  overline,
  name,
  value,
  delta,
  note,
}: {
  icon: ReactNode;
  overline: string;
  name: string;
  value: ReactNode;
  delta?: ReactNode;
  note: string;
}): ReactNode {
  return (
    <section className="flex min-w-0 flex-col gap-4 rounded-xl border border-line bg-surface p-6">
      <div className="flex items-center gap-3">
        {icon}
        <div className="flex min-w-0 flex-col gap-0.5">
          <p className="text-overline-11 text-muted-text uppercase">{overline}</p>
          <h3 className="text-heading-card-16">{name}</h3>
        </div>
      </div>
      <div className="flex flex-wrap items-center gap-2.5">
        {value}
        {delta}
      </div>
      <p className="text-body-small-13 text-ink-2">{note}</p>
    </section>
  );
}
