import Link from 'next/link';
import type { ReactNode } from 'react';
import { AccountIcon } from '@/brand/AccountIcon';
import { FeatureIcon } from '@/brand/FeatureIcon';
import { Logo } from '@/brand/Logo';
import { MarketPicker } from '../molecules/MarketPicker';
import { NavLinks } from './NavLinks';

/** Desktop navigation (≥ 1024 px), v0.4 NavBar. */
export function NavBar({ marketName }: { marketName: string }): ReactNode {
  return (
    <header className="sticky top-0 z-30 hidden border-b border-line bg-surface lg:block">
      <div className="mx-auto flex max-w-[1440px] flex-wrap items-center justify-between gap-x-6 gap-y-2 px-10 py-4 xl:px-20">
        <Link href="/beranda" className="rounded-md">
          <Logo size={40} />
        </Link>
        <nav aria-label="Navigasi utama">
          <NavLinks variant="desktop" />
        </nav>
        <div className="flex flex-wrap items-center gap-3">
          <Link
            href="/peringatan"
            aria-label="Peringatan harga"
            className="inline-flex size-11 items-center justify-center rounded-full border border-line bg-surface hover:bg-surface-2"
          >
            <FeatureIcon name="peringatan" size={22} />
          </Link>
          {/* Static link: public pages never render per-user state (ADR 0011). */}
          <Link
            href="/akun"
            aria-label="Akun"
            className="inline-flex size-11 items-center justify-center rounded-full border border-line bg-surface hover:bg-surface-2"
          >
            <AccountIcon size={22} />
          </Link>
          <MarketPicker name={marketName} shortName={marketName} variant="desktop" />
        </div>
      </div>
    </header>
  );
}
