import type { Metadata } from 'next';
import type { ReactNode } from 'react';

// Account pages (ADR 0011): rendered per request (nonce CSP from proxy.ts), never cached and
// never indexed.
export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  robots: { index: false, follow: false },
};

export default function AccountLayout({ children }: { children: ReactNode }): ReactNode {
  return children;
}
