import { EXPIRED_AFTER_DAYS, HIDDEN_AFTER_DAYS } from '../forecasts/forecast-status.js';

const DAY_MS = 86_400_000;
const WIB_OFFSET_MS = 7 * 3_600_000;
export const SUMMARY_MAX_TTL_SECONDS = 3_600;

/**
 * The summary embeds time-dependent statuses (stale data, expired/hidden forecasts). Its cache
 * entry must not outlive the next moment one of them can change:
 * - the next WIB midnight (a business day passes → fresh can become stale);
 * - the moments the active bundle turns older than 8 and 28 days.
 */
export function summaryTtlSeconds(now: Date, activeIssuedAt: Date | null): number {
  const t = now.getTime();
  const nextWibMidnight = Math.floor((t + WIB_OFFSET_MS) / DAY_MS + 1) * DAY_MS - WIB_OFFSET_MS;
  const boundaries = [t + SUMMARY_MAX_TTL_SECONDS * 1000, nextWibMidnight];
  if (activeIssuedAt !== null) {
    for (const days of [EXPIRED_AFTER_DAYS + 1, HIDDEN_AFTER_DAYS + 1]) {
      const at = activeIssuedAt.getTime() + days * DAY_MS;
      if (at > t) boundaries.push(at);
    }
  }
  return Math.max(1, Math.floor((Math.min(...boundaries) - t) / 1000));
}
