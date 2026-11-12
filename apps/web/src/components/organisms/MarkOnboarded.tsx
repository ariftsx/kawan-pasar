'use client';

import { usePathname } from 'next/navigation';
import { useEffect } from 'react';
import type { ReactNode } from 'react';

/**
 * Remembers that the visitor has moved past the orientation page, so `/` sends them straight to
 * /beranda next time (proxy.ts). The cookie identifies nobody and holds only "1".
 */
export function MarkOnboarded(): ReactNode {
  const pathname = usePathname();
  useEffect(() => {
    if (pathname === '/') return;
    const secure = window.location.protocol === 'https:' ? '; Secure' : '';
    document.cookie = `kp_onboarded=1; Max-Age=31536000; Path=/; SameSite=Lax${secure}`;
  }, [pathname]);
  return null;
}
