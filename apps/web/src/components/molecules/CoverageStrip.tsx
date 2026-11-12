import type { ReactNode } from 'react';
import { FeatureIcon } from '@/brand/FeatureIcon';

/** Data coverage notice (v0.4 CoverageStrip): which market and commodities are covered today. */
export function CoverageStrip({
  title,
  body,
  action,
}: {
  title: string;
  body: string;
  action?: ReactNode;
}): ReactNode {
  return (
    <div className="flex flex-wrap items-center gap-3 rounded-lg border border-line bg-surface px-4 py-3.5">
      <span className="inline-flex size-10 shrink-0 items-center justify-center rounded-[13px] bg-chili-100">
        <FeatureIcon name="pasar" />
      </span>
      <div className="flex min-w-0 flex-1 basis-56 flex-col gap-0.5">
        <p className="text-sm font-bold">{title}</p>
        <p className="text-body-small-13 text-ink-2">{body}</p>
      </div>
      {action}
    </div>
  );
}
