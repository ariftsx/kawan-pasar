import type { ReactNode } from 'react';
import { cx } from '@/lib/cx';

export type ChipTone =
  'neutral' | 'green' | 'chili' | 'kunyit' | 'kunyit-solid' | 'terong' | 'dark' | 'outline';

// Text colours are the AA-safe variants (see packages/tokens TEXT_PAIRS).
const TONE: Record<ChipTone, string> = {
  neutral: 'bg-surface-2 text-ink-2',
  green: 'bg-green-100 text-green-900',
  chili: 'bg-chili-100 text-chili-700',
  kunyit: 'bg-kunyit-100 text-ink',
  'kunyit-solid': 'bg-kunyit-500 text-ink',
  terong: 'bg-terong-100 text-terong-600',
  dark: 'bg-ink text-surface',
  outline: 'border border-line bg-surface text-ink-2',
};

export function Chip({
  tone = 'neutral',
  size = 'M',
  children,
  className,
}: {
  tone?: ChipTone;
  size?: 'M' | 'S';
  children: ReactNode;
  className?: string;
}): ReactNode {
  return (
    <span
      className={cx(
        'inline-flex items-center gap-1 rounded-full font-bold whitespace-nowrap',
        size === 'M'
          ? 'px-3 py-1.5 text-[13px] leading-none'
          : 'px-2 py-[3px] text-[11px] leading-tight',
        TONE[tone],
        className,
      )}
    >
      {children}
    </span>
  );
}
