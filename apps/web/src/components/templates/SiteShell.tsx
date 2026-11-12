import { MARKETS } from '@kawan-pasar/catalog';
import type { ReactNode } from 'react';
import { cx } from '@/lib/cx';
import { Footer } from '../organisms/Footer';
import { MarkOnboarded } from '../organisms/MarkOnboarded';
import { NavBar } from '../organisms/NavBar';
import { TabBar } from '../organisms/TabBar';
import { TopBar } from '../organisms/TopBar';

// Fase 1: one market with data. Market selection arrives with more markets.
const MARKET_NAME: string = MARKETS[0].name;
const SHORT_NAME = MARKET_NAME.replace(/^Pasar\s+/, '');

/**
 * Responsive frame of every public page: NavBar on desktop (≥ 1024 px), TopBar + bottom TabBar
 * below that, Footer everywhere. Server component; only the nav links hydrate.
 */
export function SiteShell({ children }: { children: ReactNode }): ReactNode {
  return (
    <>
      <a
        href="#konten"
        className="sr-only z-50 rounded-full bg-green-900 px-4 py-3 font-bold text-surface focus:not-sr-only focus:fixed focus:top-3 focus:left-3"
      >
        Lewati ke konten
      </a>
      <NavBar marketName={MARKET_NAME} />
      <TopBar marketName={MARKET_NAME} shortName={SHORT_NAME} />
      <div className="flex flex-1 flex-col">
        <main id="konten" tabIndex={-1} className="flex-1 focus:outline-none">
          {children}
        </main>
        <Footer marketName={MARKET_NAME} />
      </div>
      <TabBar />
      <MarkOnboarded />
    </>
  );
}

/** Content column: max 1280 px, side margins 16 / 24 / 80 px. */
export function PageContainer({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}): ReactNode {
  return (
    <div className="mx-auto w-full max-w-[1440px] px-4 sm:px-6 lg:px-10 xl:px-20">
      <div className={cx('mx-auto w-full max-w-[1280px]', className)}>{children}</div>
    </div>
  );
}
