'use client';

import { cn } from '@kawan-pasar/ui';
import { usePathname } from 'next/navigation';
import { Link } from 'react-aria-components';

import { Icon } from '@/components/icons';

import { MOBILE_TABS, isActive } from './nav-items';

/** Mobile navigation (docs 10 §7.5): five tabs, sticky, above the safe-area inset. */
export function BottomTabBar() {
  const pathname = usePathname();
  return (
    <nav
      aria-label="Navigasi bawah"
      className="fixed inset-x-0 bottom-0 z-sticky border-t border-border-default bg-bg-surface pb-safe lg:hidden"
    >
      <ul className="grid grid-cols-5">
        {MOBILE_TABS.map((tab) => {
          const active = isActive(pathname, tab.href);
          return (
            <li key={tab.href}>
              <Link
                href={tab.href}
                {...(active ? { 'aria-current': 'page' as const } : {})}
                className={cn(
                  'group flex min-h-16 flex-col items-center justify-center gap-1 text-xs outline-none',
                  'data-[focus-visible]:outline-2 data-[focus-visible]:-outline-offset-2 data-[focus-visible]:outline-border-focus',
                  active ? 'font-bold text-text-brand' : 'text-text-secondary',
                )}
              >
                {/* The pill behind the active icon shows "you are here" without relying on colour. */}
                <span
                  className={cn(
                    'flex h-8 w-14 items-center justify-center rounded-full',
                    active ? 'bg-bg-brand-subtle' : 'group-data-[hovered]:bg-bg-subtle',
                  )}
                >
                  <Icon name={tab.icon} />
                </span>
                {tab.short}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
