'use client';

import Link from 'next/link';
import type { Route } from 'next';
import { usePathname } from 'next/navigation';
import type { ReactNode } from 'react';
import { cx } from '@/lib/cx';

const TABS: readonly { href: Route; label: string }[] = [
  { href: '/admin', label: 'Pengajuan' },
  { href: '/admin/pengguna', label: 'Pengguna' },
  { href: '/admin/artikel', label: 'Artikel' },
  { href: '/admin/pemantauan', label: 'Pemantauan' },
  { href: '/admin/pipeline', label: 'Pipeline' },
  { href: '/admin/model', label: 'Model' },
];

export function AdminTabs(): ReactNode {
  const path = usePathname();
  return (
    <nav aria-label="Menu admin" className="overflow-x-auto">
      <ul className="flex gap-1 border-b border-line">
        {TABS.map((t) => {
          const active = t.href === '/admin' ? path === '/admin' : path.startsWith(t.href);
          return (
            <li key={t.href}>
              <Link
                href={t.href}
                aria-current={active ? 'page' : undefined}
                className={cx(
                  'inline-flex min-h-11 items-center border-b-2 px-4 text-[14px] font-semibold whitespace-nowrap',
                  active ? 'border-green-900 text-green-900' : 'border-transparent text-ink-2',
                )}
              >
                {t.label}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
