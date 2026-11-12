import Link from 'next/link';
import type { ReactNode } from 'react';
import { Logo } from '@/brand/Logo';
import { MarketPicker } from '../molecules/MarketPicker';

/** Mobile/tablet top bar (< 1024 px), v0.4 TopBar. */
export function TopBar({
  marketName,
  shortName,
}: {
  marketName: string;
  shortName: string;
}): ReactNode {
  return (
    <header className="flex items-center justify-between gap-3 bg-canvas px-4 pt-3.5 pb-2.5 sm:px-6 lg:hidden">
      <Link href="/beranda" className="rounded-md">
        <Logo size={32} />
      </Link>
      <MarketPicker name={marketName} shortName={shortName} variant="mobile" />
    </header>
  );
}
