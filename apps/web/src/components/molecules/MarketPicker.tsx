import Link from 'next/link';
import type { ReactNode } from 'react';
import { FeatureIcon } from '@/brand/FeatureIcon';
import { cx } from '@/lib/cx';

/** Current market with a link to the market chooser (v0.4 MarketPicker). */
export function MarketPicker({
  name,
  shortName,
  variant,
}: {
  name: string;
  shortName: string;
  variant: 'desktop' | 'mobile';
}): ReactNode {
  return (
    <Link
      href="/pasar"
      className={cx(
        'inline-flex min-h-11 items-center gap-2 rounded-full border border-line',
        variant === 'desktop' ? 'bg-surface-2 py-2 pr-4 pl-3' : 'bg-surface py-2 pr-3 pl-2.5',
      )}
    >
      <FeatureIcon name="pasar" size={variant === 'desktop' ? 20 : 18} />
      {variant === 'desktop' ? (
        <span className="flex flex-col leading-tight">
          <span className="text-[10px] font-bold tracking-[0.06em] text-muted-text">PASAR</span>
          <span className="text-sm font-bold">{name}</span>
        </span>
      ) : (
        <span className="text-[13px] font-bold">{shortName}</span>
      )}
      <span className="sr-only">, ganti pasar</span>
      <FeatureIcon name="bawah" size={variant === 'desktop' ? 18 : 16} />
    </Link>
  );
}
