import type { ReactNode } from 'react';
import { cx } from '@/lib/cx';
import { formatRupiah } from '@/lib/format';

const PRICE_SIZE = {
  xl: 'text-numeric-xl-44',
  l: 'text-numeric-l-30',
  m: 'text-numeric-m-24',
  s: 'text-numeric-s-14',
} as const;

/** Rupiah amount in Geist Mono with tabular figures. `null` renders "—". */
export function Price({
  value,
  size = 'm',
  className,
}: {
  value: number | null;
  size?: keyof typeof PRICE_SIZE;
  className?: string;
}): ReactNode {
  return (
    <span
      className={cx(
        'tabular font-mono font-semibold whitespace-nowrap',
        PRICE_SIZE[size],
        className,
      )}
    >
      {formatRupiah(value)}
    </span>
  );
}
