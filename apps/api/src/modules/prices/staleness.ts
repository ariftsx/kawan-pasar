import type { DataStatus } from '@kawan-pasar/contracts';

/** Prices older than this many business days are "terlambat" (FR-04). */
export const STALE_AFTER_BUSINESS_DAYS = 2;

const WIB_OFFSET_MS = 7 * 3_600_000;

/** Calendar day in Asia/Jakarta (fixed UTC+7, no DST) as YYYY-MM-DD. */
export function wibDate(at: Date): string {
  return new Date(at.getTime() + WIB_OFFSET_MS).toISOString().slice(0, 10);
}

/**
 * Monday–Friday days after `from` up to and including `to` (both YYYY-MM-DD).
 * National holidays are not excluded yet (documented limitation).
 */
export function businessDaysBetween(from: string, to: string): number {
  const start = Date.parse(`${from}T00:00:00Z`);
  const end = Date.parse(`${to}T00:00:00Z`);
  let count = 0;
  for (let t = start + 86_400_000; t <= end; t += 86_400_000) {
    const day = new Date(t).getUTCDay();
    if (day !== 0 && day !== 6) count += 1;
  }
  return count;
}

export function dataStatus(latestObservedOn: string | null, today: string): DataStatus {
  if (latestObservedOn === null) return 'no_data';
  return businessDaysBetween(latestObservedOn, today) > STALE_AFTER_BUSINESS_DAYS
    ? 'stale'
    : 'fresh';
}
