import type { Route } from 'next';
import Link from 'next/link';
import type { ReactNode } from 'react';
import { FeatureIcon } from '@/brand/FeatureIcon';
import type { FeatureIconName } from '@/brand/FeatureIcon';
import { cx } from '@/lib/cx';

/** Mobile bottom-tab item (v0.4 TabItem). */
export function TabItem({
  href,
  icon,
  label,
  active,
}: {
  href: Route;
  icon: FeatureIconName;
  label: string;
  active: boolean;
}): ReactNode {
  return (
    <Link
      href={href}
      aria-current={active ? 'page' : undefined}
      className={cx(
        'flex min-h-11 w-full min-w-0 flex-col items-center gap-1 rounded-2xl px-1 py-1.5 text-[11px]',
        active ? 'bg-green-100 font-bold text-green-900' : 'font-medium text-ink-2',
      )}
    >
      <FeatureIcon name={icon} size={22} />
      <span className="max-w-full truncate">{label}</span>
    </Link>
  );
}
