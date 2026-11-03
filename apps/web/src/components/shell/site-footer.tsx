import Link from 'next/link';

import { LogoMark } from '@/components/brand/logo-mark';

import type { Route } from 'next';

const COLUMNS: readonly { title: string; links: readonly { href: Route; label: string }[] }[] = [
  {
    title: 'Produk',
    links: [
      { href: '/', label: 'Beranda' },
      { href: '/harga', label: 'Harga' },
      { href: '/prediksi', label: 'Prediksi' },
      { href: '/peringatan', label: 'Peringatan' },
    ],
  },
  {
    title: 'Edukasi',
    links: [
      { href: '/edukasi', label: 'Semua topik' },
      { href: '/edukasi/inflasi-pangan', label: 'Inflasi pangan' },
    ],
  },
  {
    title: 'ARIF-Net',
    links: [
      { href: '/arif-net', label: 'Kenalan' },
      { href: '/arif-net/keterbatasan', label: 'Keterbatasan' },
      { href: '/analis', label: 'Mode Analis' },
    ],
  },
];

/** Footer (docs 10 §7.5): disclaimer and data source; it never claims more than the data supports. */
export function SiteFooter({ isDemo }: { readonly isDemo: boolean }) {
  return (
    <footer className="mt-16 bg-accent-brand-strong pb-24 text-accent-on-brand-strong lg:pb-0">
      <div className="mx-auto flex max-w-content flex-col gap-8 px-4 py-10 lg:px-12">
        <div className="flex flex-col justify-between gap-8 md:flex-row">
          <div className="flex max-w-sm flex-col gap-3">
            <p className="flex items-center gap-2 text-lg font-extrabold">
              <LogoMark className="w-8" />
              kawan pasar
            </p>
            <p className="text-sm">
              Pantau harga pangan dan perkiraannya, supaya belanja lebih tenang.
            </p>
          </div>
          <div className="grid grid-cols-2 gap-8 sm:grid-cols-3">
            {COLUMNS.map((column) => (
              <div key={column.title} className="flex flex-col gap-2">
                <p className="text-xs font-bold tracking-wider uppercase">{column.title}</p>
                <ul className="flex flex-col gap-1">
                  {column.links.map((link) => (
                    <li key={link.href}>
                      <Link
                        href={link.href}
                        className="text-sm underline-offset-4 hover:underline focus-visible:outline-2 focus-visible:outline-offset-2"
                      >
                        {link.label}
                      </Link>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </div>
        <div className="flex flex-col gap-1 border-t border-current/20 pt-6 text-sm">
          <p>
            Bukan rekomendasi jual atau beli. Prediksi adalah estimasi model ARIF-Net, bukan jaminan
            harga.
          </p>
          <p>
            Data: PIHPS · Pasar Kramat Jati. Bukan real-time; tanggal observasi selalu ditampilkan.
            {isDemo ? ' Mode demo: angka berlabel DATA DEMO adalah contoh.' : ''}
          </p>
        </div>
      </div>
    </footer>
  );
}
