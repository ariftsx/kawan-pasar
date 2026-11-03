'use client';

import { defaultMarket } from '@kawan-pasar/catalog';
import { cn } from '@kawan-pasar/ui';
import { usePathname } from 'next/navigation';
import { Link } from 'react-aria-components';

import { FeatureIcon } from '@/components/brand/feature-icon';
import { LogoMark } from '@/components/brand/logo-mark';

import { PRIMARY_NAV, isActive } from './nav-items';

const FOCUS =
  'outline-none data-[focus-visible]:outline-2 data-[focus-visible]:outline-offset-2 data-[focus-visible]:outline-border-focus';

export function SiteHeader() {
  const pathname = usePathname();
  const market = defaultMarket();
  return (
    <header className="sticky top-0 z-sticky border-b border-border-default bg-bg-surface">
      <div className="mx-auto flex h-16 max-w-content items-center gap-3 px-4 sm:gap-6 lg:px-12">
        <Link
          href="/"
          className={cn(
            'flex shrink-0 items-center gap-2 rounded-md text-lg font-extrabold whitespace-nowrap',
            FOCUS,
          )}
        >
          <LogoMark className="w-9" />
          <span className="tracking-tight text-text-primary">kawan pasar</span>
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
                      'flex min-h-11 items-center gap-2 rounded-full px-3 text-sm',
                      active
                        ? 'bg-bg-brand-subtle font-semibold text-text-brand'
                        : 'text-text-secondary data-[hovered]:bg-bg-subtle',
                      FOCUS,
                    )}
                  >
                    <FeatureIcon name={item.icon} className="size-5" />
                    {item.label}
                  </Link>
                </li>
              );
            })}
          </ul>
        </nav>
        <div className="ml-auto flex items-center gap-2">
          <Link
            href="/peringatan"
            aria-label="Peringatan harga"
            className={cn(
              'hidden size-11 items-center justify-center rounded-full border border-border-default lg:flex',
              FOCUS,
            )}
          >
            <FeatureIcon name="peringatan" className="size-5" />
          </Link>
          <Link
            href="/pasar"
            className={cn(
              'flex min-h-11 items-center gap-2 rounded-full border border-border-default px-3 text-left',
              FOCUS,
            )}
          >
            <FeatureIcon name="pasar" className="size-5" />
            <span className="flex flex-col leading-tight">
              <span className="text-xs text-text-muted">Pasar</span>
              <span className="text-sm font-semibold whitespace-nowrap text-text-primary">
                <span className="hidden md:inline">{market.name}</span>
                <span className="md:hidden">{market.name.replace(/^Pasar /, '')}</span>
              </span>
            </span>
          </Link>
        </div>
      </div>
    </header>
  );
}
