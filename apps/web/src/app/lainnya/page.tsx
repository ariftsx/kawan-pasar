import { Card } from '@kawan-pasar/ui';
import Link from 'next/link';

import { Icon } from '@/components/icons';

import type { Metadata, Route } from 'next';

export const metadata: Metadata = { title: 'Lainnya' };

const LINKS: readonly { href: Route; label: string; note: string }[] = [
  { href: '/atur-warung', label: 'Atur warung', note: 'Tambah menu dari template' },
  { href: '/konteks', label: 'Konteks', note: 'Iklim, berita, logistik' },
  { href: '/pelajari', label: 'Pelajari', note: 'Cara membaca harga & perkiraan' },
];

/** Secondary navigation for mobile (docs 05 §5.1). */
export default function LainnyaPage() {
  return (
    <div className="flex flex-col gap-4">
      <h1 className="text-3xl font-bold">Lainnya</h1>
      <Card>
        <ul className="flex flex-col divide-y divide-border-default">
          {LINKS.map((link) => (
            <li key={link.href}>
              <Link
                href={link.href}
                className="flex min-h-16 items-center justify-between gap-3 rounded-md px-2 focus-visible:outline-2 focus-visible:outline-border-focus"
              >
                <span className="flex flex-col">
                  <span className="text-lg font-semibold text-text-primary">{link.label}</span>
                  <span className="text-base text-text-secondary">{link.note}</span>
                </span>
                <Icon name="chevron-right" className="text-text-secondary" />
              </Link>
            </li>
          ))}
        </ul>
      </Card>
    </div>
  );
}
