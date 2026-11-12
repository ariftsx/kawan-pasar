import type { ReactNode } from 'react';
import { cx } from '@/lib/cx';

/** Horizon selector pill (v0.4 HorizonPill). Interactive parents pass `onClick`. */
export function HorizonPill({
  label,
  longLabel,
  active,
  onClick,
}: {
  label: string;
  longLabel: string;
  active: boolean;
  onClick?: () => void;
}): ReactNode {
  return (
    <button
      type="button"
      aria-pressed={active}
      onClick={onClick}
      className={cx(
        'min-h-11 min-w-11 rounded-full px-3 py-1.5 text-[13px] font-bold',
        active ? 'bg-surface text-ink shadow-[0_1px_3px_#14201A14]' : 'text-muted-text',
      )}
    >
      {label}
      {/* Visible label stays first in the name ("7H (7 hari)") so voice commands match it. */}
      <span className="sr-only"> ({longLabel})</span>
    </button>
  );
}
