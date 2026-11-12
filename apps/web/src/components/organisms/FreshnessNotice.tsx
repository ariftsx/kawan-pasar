'use client';

import { useSyncExternalStore } from 'react';
import type { ReactNode } from 'react';
import { formatDateWib } from '@/lib/format';
import { isPageStale } from '@/lib/insights/freshness';

const noSubscription = (): (() => void) => () => undefined;

/**
 * A cached (ISR) page may outlive its data, e.g. while the API is down. This checks the
 * staleness rule against the visitor's clock, after hydration (no server/client mismatch), and
 * shows a notice even when the server rendered the page while the data was still fresh.
 */
export function FreshnessNotice({
  latestObservedOn,
  staleAtRender = false,
}: {
  latestObservedOn: string | null;
  /** Data already stale when the server rendered the page (shown even without JavaScript). */
  staleAtRender?: boolean;
}): ReactNode {
  const stale = useSyncExternalStore(
    noSubscription,
    () => isPageStale(latestObservedOn, new Date()),
    // Server render and hydration use the server's verdict; the client re-checks right after.
    () => staleAtRender,
  );
  if (!stale || latestObservedOn === null) return null;
  return (
    <p
      role="status"
      className="rounded-md border border-kunyit-500 bg-kunyit-100 px-4 py-3 text-body-small-13 text-ink"
    >
      <strong>Harga belum diperbarui.</strong> Data terakhir{' '}
      {formatDateWib(latestObservedOn, 'short')}; harga di pasar hari ini bisa berbeda.
    </p>
  );
}
