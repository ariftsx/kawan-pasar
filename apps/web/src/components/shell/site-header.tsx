'use client';

import { cn } from '@kawan-pasar/ui';
import { usePathname } from 'next/navigation';
import { Link } from 'react-aria-components';

import { PRIMARY_NAV, isActive } from './nav-items';

const FOCUS =
  'outline-none data-[focus-visible]:outline-2 data-[focus-visible]:outline-offset-2 data-[focus-visible]:outline-border-focus';

export function SiteHeader() {
  const pathname = usePathname();
  return (
    <header className="sticky top-0 z-sticky border-b border-border-default bg-bg-surface">
      <div className="mx-auto flex h-14 max-w-content items-center gap-6 px-4 lg:px-12">
        <Link href="/" className={cn('flex items-center gap-2 rounded-md font-semibold', FOCUS)}>
          <span
            aria-hidden="true"
            className="flex size-8 items-center justify-center rounded-md bg-bg-brand text-text-on-brand"
          >
            K
          </span>
          <span className="text-text-primary">Kawan Pasar</span>
        </Link>
        <nav aria-label="Navigasi utama" className="hidden flex-1 lg:block">
          <ul className="flex items-center gap-1">
            {PRIMARY_NAV.map((item) => {
              const active = isActive(pathname, item.href);
              return (
                <li key={item.href}>
                  <Link
                    href={item.href}
                    {...(active ? { 'aria-current': 'page' as const } : {})}
                    className={cn(
                      'rounded-md px-3 py-2 text-sm',
                      active
                        ? 'bg-bg-brand-subtle font-semibold text-text-brand'
                        : 'text-text-secondary data-[hovered]:bg-bg-subtle',
                      FOCUS,
                    )}
                  >
                    {item.label}
                  </Link>
                </li>
              );
            })}
          </ul>
        </nav>
        <Link
          href="/atur-warung"
          className={cn(
            'ml-auto rounded-md px-3 py-2 text-sm text-text-brand data-[hovered]:bg-bg-brand-subtle',
            FOCUS,
          )}
        >
          Warung Saya
        </Link>
      </div>
    </header>
  );
}
