// Subpath import: this runs in a client component (FreshnessNotice), and the package index would
// pull every zod schema into the browser bundle (~30 KB compressed).
import { dataStatus, wibDate } from '@kawan-pasar/contracts/staleness';

/** Same rule as the API (> 2 business days, WIB), evaluated at view time. */
export function isPageStale(latestObservedOn: string | null, now: Date): boolean {
  if (latestObservedOn === null) return false;
  return dataStatus(latestObservedOn, wibDate(now)) === 'stale';
}
