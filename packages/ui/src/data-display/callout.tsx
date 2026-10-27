import { cn } from '../cn.js';

import type { ReactNode } from 'react';

export type CalloutTone = 'info' | 'warning' | 'limitation' | 'error';

// Icons are SVG paths: symbol glyphs such as ⓘ or ◐ are missing from many fonts.
const CIRCLE = 'M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18Z';
const STYLE: ReadonlyMap<CalloutTone, { box: string; icon: string }> = new Map([
  ['info', { box: 'bg-status-info-bg text-status-info-fg', icon: `${CIRCLE}M12 11v5M12 7.5h.01` }],
  [
    'warning',
    {
      box: 'bg-status-partial-bg text-status-partial-fg',
      icon: 'M10.3 4.3 2.6 18a2 2 0 0 0 1.7 3h15.4a2 2 0 0 0 1.7-3L13.7 4.3a2 2 0 0 0-3.4 0ZM12 9v4M12 17h.01',
    },
  ],
  ['limitation', { box: 'bg-bg-subtle text-text-secondary', icon: `${CIRCLE}M12 3v18` }],
  [
    'error',
    { box: 'bg-status-error-bg text-status-error-fg', icon: `${CIRCLE}M15 9l-6 6M9 9l6 6` },
  ],
]);

export type CalloutProps = {
  readonly tone: CalloutTone;
  readonly title: string;
  readonly children?: ReactNode;
  readonly className?: string;
};

/** Title + body with a tone icon (docs 10 §7.2). Errors are announced as alerts. */
export function Callout({ tone, title, children, className }: CalloutProps) {
  const style = STYLE.get(tone);
  return (
    <div
      role={tone === 'error' ? 'alert' : 'note'}
      className={cn('flex gap-3 rounded-lg p-4 text-base', style?.box, className)}
    >
      <svg
        viewBox="0 0 24 24"
        aria-hidden="true"
        className="mt-0.5 size-6 shrink-0"
        fill="none"
        stroke="currentColor"
        strokeWidth={2.2}
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <path d={style?.icon} />
      </svg>
      <div className="flex flex-col gap-1">
        <p className="font-semibold">{title}</p>
        {children === undefined ? null : <div className="text-text-primary">{children}</div>}
      </div>
    </div>
  );
}
