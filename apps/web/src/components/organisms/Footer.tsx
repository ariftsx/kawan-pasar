import type { Route } from 'next';
import Link from 'next/link';
import type { ReactNode } from 'react';
import { Logo } from '@/brand/Logo';
import { TAB_BAR_SPACE } from './TabBar';

interface FooterLink {
  label: string;
  href: Route | null;
}

const COLUMNS: readonly { title: string; links: readonly FooterLink[] }[] = [
  {
    title: 'Produk',
    links: [
      { label: 'Beranda', href: '/beranda' },
      { label: 'Harga', href: '/harga' },
      { label: 'Prediksi', href: '/prediksi' },
      { label: 'Peringatan', href: '/peringatan' },
    ],
  },
  {
    title: 'Edukasi',
    links: [
      { label: 'Inflasi pangan', href: '/edukasi' },
      { label: 'Membaca harga', href: '/edukasi' },
      { label: 'Membaca prediksi', href: '/edukasi' },
    ],
  },
  {
    title: 'ARIF-Net',
    links: [
      { label: 'Kenalan', href: '/arif-net' },
      { label: 'Keterbatasan', href: '/arif-net/keterbatasan' },
      { label: 'Mode Analis', href: '/analis' },
    ],
  },
];

/** Site footer (v0.4 Footer) with the mandatory "not a recommendation" statement. */
export function Footer({ marketName }: { marketName: string }): ReactNode {
  return (
    <footer className={`bg-green-900 text-surface ${TAB_BAR_SPACE}`}>
      <div className="mx-auto flex max-w-[1440px] flex-col gap-10 px-4 pt-12 pb-10 sm:px-6 lg:px-20 lg:pt-16">
        <div className="flex flex-col justify-between gap-10 md:flex-row">
          <div className="flex flex-col gap-4">
            <Logo tone="inverse" size={40} />
            <p className="max-w-xs text-[15px] leading-relaxed text-surface/80">
              Pantau harga pangan dan perkiraannya, supaya belanja lebih tenang.
            </p>
          </div>
          <div className="grid grid-cols-2 gap-8 sm:grid-cols-3 sm:gap-16">
            {COLUMNS.map((col) => (
              <nav
                key={col.title}
                aria-label={`Footer: ${col.title}`}
                className="flex flex-col gap-2.5"
              >
                <h2 className="text-xs font-bold tracking-[0.08em] text-kunyit-500 uppercase">
                  {col.title}
                </h2>
                <ul className="flex flex-col gap-1">
                  {col.links.map((l) => (
                    <li key={l.label}>
                      {l.href === null ? (
                        <span className="inline-block py-2 text-sm font-medium text-surface/70">
                          {l.label}
                        </span>
                      ) : (
                        <Link
                          href={l.href}
                          className="inline-block py-2 text-sm font-medium text-surface/90 hover:text-surface hover:underline"
                        >
                          {l.label}
                        </Link>
                      )}
                    </li>
                  ))}
                </ul>
              </nav>
            ))}
          </div>
        </div>
        <div className="flex flex-col justify-between gap-3 border-t border-surface/15 pt-6 text-[13px] text-surface/75 md:flex-row">
          <p>
            Bukan rekomendasi jual/beli. Prediksi adalah estimasi model ARIF-Net, bukan jaminan
            harga.
          </p>
          <p className="font-semibold">Data: PIHPS · {marketName}</p>
        </div>
      </div>
    </footer>
  );
}
