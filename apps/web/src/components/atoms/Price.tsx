import type { ReactNode } from 'react';
import { cx } from '@/lib/cx';
import { formatRupiah } from '@/lib/format';

const PRICE_SIZE = {
  xl: 'text-numeric-xl-44',
  l: 'text-numeric-l-30',
  m: 'text-numeric-m-24',
  s: 'text-numeric-s-14',
} as const;

/**
 * Large figures shrink with the viewport on narrow screens (the rupiah amount never wraps) while
 * still growing with text zoom (rem bounds). Inline, so it always wins over the type-scale size.
 */
const FLUID: Partial<Record<keyof typeof PRICE_SIZE, string>> = {
  xl: 'clamp(1.5rem, 9vw, 2.75rem)',
  l: 'clamp(1.25rem, 7vw, 1.875rem)',
};

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
  const fluid = FLUID[size];
  return (
    <span
      className={cx(
        // Negative letter-spacing lets the last glyph overhang its box; keep it inside.
        'tabular font-mono font-semibold whitespace-nowrap pr-[0.05em]',
        PRICE_SIZE[size],
        className,
      )}
      style={fluid === undefined ? undefined : { fontSize: fluid }}
    >
      {formatRupiah(value)}
    </span>
  );
}
