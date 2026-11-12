import type { ReactNode } from 'react';
import { cx } from '@/lib/cx';
import { UNKNOWN, changeDirection, formatChange } from '@/lib/format';

const STYLE = {
  up: { cls: 'bg-chili-100 text-chili-700', arrow: '↑', word: 'naik' },
  down: { cls: 'bg-green-100 text-green-700', arrow: '↓', word: 'turun' },
  flat: { cls: 'bg-surface-2 text-ink-2', arrow: null, word: 'stabil' },
} as const;

/**
 * Price change pill. Direction is never carried by colour alone: arrow + sign are visible and a
 * word ("naik/turun/stabil") is read by screen readers.
 */
export function Delta({
  value,
  size = 'M',
}: {
  value: number | null;
  size?: 'M' | 'S';
}): ReactNode {
  const dir = changeDirection(value);
  const pad = size === 'M' ? 'px-2.5 py-1 text-xs' : 'px-[7px] py-0.5 text-[10px]';
  if (dir === null) {
    return (
      <span className={cx('inline-flex rounded-full bg-surface-2 font-bold text-ink-2', pad)}>
        <span className="sr-only">perubahan tidak diketahui </span>
        {UNKNOWN}
      </span>
    );
  }
  const s = STYLE[dir];
  return (
    <span
      className={cx(
        'tabular inline-flex items-center gap-0.5 rounded-full font-bold whitespace-nowrap',
        s.cls,
        pad,
      )}
    >
      <span className="sr-only">{s.word} </span>
      {s.arrow === null ? null : (
        <>
          <span aria-hidden="true">{s.arrow}</span>{' '}
        </>
      )}
      {formatChange(value)}
    </span>
  );
}
