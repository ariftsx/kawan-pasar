import { cn } from '../cn.js';

import type { ReactNode } from 'react';

export type CalloutTone = 'info' | 'warning' | 'limitation' | 'error';

const STYLE: ReadonlyMap<CalloutTone, { box: string; icon: string }> = new Map([
  ['info', { box: 'bg-status-info-bg text-status-info-fg', icon: 'ⓘ' }],
  ['warning', { box: 'bg-status-partial-bg text-status-partial-fg', icon: '!' }],
  ['limitation', { box: 'bg-bg-subtle text-text-secondary', icon: '◐' }],
  ['error', { box: 'bg-status-error-bg text-status-error-fg', icon: '×' }],
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
      className={cn('flex gap-3 rounded-md p-3 text-sm', style?.box, className)}
    >
      <span aria-hidden="true" className="font-semibold">
        {style?.icon}
      </span>
      <div className="flex flex-col gap-1">
        <p className="font-semibold">{title}</p>
        {children === undefined ? null : <div className="text-text-primary">{children}</div>}
      </div>
    </div>
  );
}
