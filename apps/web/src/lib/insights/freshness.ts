import { dataStatus, wibDate } from '@kawan-pasar/contracts';

/** Same rule as the API (> 2 business days, WIB), evaluated at view time. */
export function isPageStale(latestObservedOn: string | null, now: Date): boolean {
  if (latestObservedOn === null) return false;
  return dataStatus(latestObservedOn, wibDate(now)) === 'stale';
}
