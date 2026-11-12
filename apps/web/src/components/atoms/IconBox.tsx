import type { ReactNode } from 'react';
import { cx } from '@/lib/cx';

export type IconBoxTone = 'chili' | 'green' | 'kunyit' | 'terong' | 'surface';

const ICON_BOX: Record<IconBoxTone, string> = {
  chili: 'bg-chili-100',
  green: 'bg-green-100',
  kunyit: 'bg-kunyit-100',
  terong: 'bg-terong-100',
  surface: 'bg-surface-2',
};

/** Tinted box behind a commodity or feature icon. */
export function IconBox({
  tone,
  size = 52,
  children,
}: {
  tone: IconBoxTone;
  size?: 52 | 40;
  children: ReactNode;
}): ReactNode {
  return (
    <span
      className={cx(
        'inline-flex shrink-0 items-center justify-center',
        size === 52 ? 'size-[52px] rounded-[16px]' : 'size-10 rounded-[13px]',
        ICON_BOX[tone],
      )}
    >
      {children}
    </span>
  );
}
