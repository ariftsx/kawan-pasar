import type { ForecastStatus } from '@kawan-pasar/contracts';

/** Bundles older than this are labelled "kedaluwarsa" (numbers still shown, with a label). */
export const EXPIRED_AFTER_DAYS = 8;
/** Bundles older than this are not shown at all. */
export const HIDDEN_AFTER_DAYS = 28;

const DAY_MS = 86_400_000;

export function ageDays(issuedAt: Date, now: Date): number {
  return Math.max(0, Math.floor((now.getTime() - issuedAt.getTime()) / DAY_MS));
}

/** Product rule for whether and how a forecast may be shown (design §3, report §2.4). */
export function forecastStatus(
  coverage: 'covered' | 'pending',
  artifact: { readonly issuedAt: Date } | null,
  now: Date,
): ForecastStatus {
  if (coverage === 'pending') return 'pending_coverage';
  if (artifact === null) return 'unavailable';
  const age = ageDays(artifact.issuedAt, now);
  if (age > HIDDEN_AFTER_DAYS) return 'hidden';
  if (age > EXPIRED_AFTER_DAYS) return 'expired';
  return 'available';
}
