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
        // Tighter below 1440 px so the desktop bar stays on one row at 1280 (touch target stays 44 px).
        'inline-flex min-h-11 items-center gap-2 rounded-full py-2.5 pr-3 pl-2.5 text-[15px] transition-colors min-[1440px]:pr-4 min-[1440px]:pl-3.5',
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
