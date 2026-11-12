'use client';

import { usePathname } from 'next/navigation';
import type { ReactNode } from 'react';
import { DESKTOP_NAV, MOBILE_TABS, isActive } from '@/lib/nav';
import { NavItem } from '../atoms/NavItem';
import { TabItem } from '../atoms/TabItem';

/**
 * The only client part of the navigation: it reads the pathname to set `aria-current`. Links
 * themselves are plain <a> elements and work without JavaScript.
 */
export function NavLinks({ variant }: { variant: 'desktop' | 'mobile' }): ReactNode {
  const pathname = usePathname();
  if (variant === 'desktop') {
    return (
      <ul className="flex flex-wrap items-center gap-1">
        {DESKTOP_NAV.map((e) => (
          <li key={e.href}>
            <NavItem
              href={e.href}
              icon={e.icon}
              label={e.label}
              active={isActive(pathname, e.href)}
            />
          </li>
        ))}
      </ul>
    );
  }
  return (
    <ul className="grid grid-cols-5 gap-1">
      {MOBILE_TABS.map((e) => (
        <li key={e.href} className="min-w-0">
          <TabItem
            href={e.href}
            icon={e.icon}
            label={e.label}
            active={isActive(pathname, e.href)}
          />
        </li>
      ))}
    </ul>
  );
}
