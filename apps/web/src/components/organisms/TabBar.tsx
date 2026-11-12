import type { ReactNode } from 'react';
import { NavLinks } from './NavLinks';

/**
 * Mobile/tablet bottom tabs (< 1024 px), v0.4 TabBar. Fixed to the bottom with the safe-area
 * inset; the shell reserves the same space below the content so nothing is hidden behind it.
 */
export function TabBar(): ReactNode {
  return (
    <nav
      aria-label="Navigasi utama"
      className="fixed inset-x-0 bottom-0 z-30 border-t border-line bg-surface px-3 pt-2.5 pb-[max(0.75rem,env(safe-area-inset-bottom))] lg:hidden"
    >
      <NavLinks variant="mobile" />
    </nav>
  );
}

/** Space the footer keeps free at the bottom on mobile so the fixed TabBar hides nothing. */
export const TAB_BAR_SPACE = 'pb-[calc(5.5rem+env(safe-area-inset-bottom))] lg:pb-0';
