'use client';

import { cn } from '@kawan-pasar/ui';
import { usePathname } from 'next/navigation';
import { Link } from 'react-aria-components';

import { MOBILE_TABS, isActive } from './nav-items';

const ICON: ReadonlyMap<string, string> = new Map([
  ['/', '⌂'],
  ['/pantau', '◔'],
  ['/rencana', '☰'],
  ['/outlook', '★'],
  ['/lainnya', '⋯'],
]);

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
                  'flex min-h-14 flex-col items-center justify-center gap-0.5 text-xs outline-none',
                  'data-[focus-visible]:outline-2 data-[focus-visible]:-outline-offset-2 data-[focus-visible]:outline-border-focus',
                  active ? 'font-semibold text-text-brand' : 'text-text-secondary',
                )}
              >
                <span aria-hidden="true" className="text-lg leading-none">
                  {ICON.get(tab.href)}
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
