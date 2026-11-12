import type { Route } from 'next';
import Link from 'next/link';
import type { ReactNode } from 'react';
import { FeatureIcon } from '@/brand/FeatureIcon';
import type { FeatureIconName } from '@/brand/FeatureIcon';
import { cx } from '@/lib/cx';

/** Desktop navigation pill (v0.4 NavItem). */
export function NavItem({
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
        'inline-flex min-h-11 items-center gap-2 rounded-full py-2.5 pr-4 pl-3.5 text-[15px] transition-colors',
        active
          ? 'bg-green-100 font-bold text-green-900'
          : 'font-medium text-ink-2 hover:bg-surface-2',
      )}
    >
      <FeatureIcon name={icon} size={20} />
      {label}
    </Link>
  );
}
