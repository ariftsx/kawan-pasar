import type { Horizon } from '@kawan-pasar/catalog';

/** Display for any unknown value (product rule: never show 0 for "unknown"). */
export const UNKNOWN = '—';

const NBSP = ' ';
const MINUS = '−';

const integer = new Intl.NumberFormat('id-ID', { maximumFractionDigits: 0 });

const percentFormats = new Map<number, Intl.NumberFormat>();
const percent = (digits: number): Intl.NumberFormat => {
  let f = percentFormats.get(digits);
  if (f === undefined) {
    f = new Intl.NumberFormat('id-ID', {
      style: 'percent',
      minimumFractionDigits: digits,
      maximumFractionDigits: digits,
      signDisplay: 'exceptZero',
    });
    percentFormats.set(digits, f);
  }
  return f;
};

const dateFormats = {
  short: new Intl.DateTimeFormat('id-ID', {
    timeZone: 'Asia/Jakarta',
    weekday: 'short',
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  }),
  long: new Intl.DateTimeFormat('id-ID', {
    timeZone: 'Asia/Jakarta',
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  }),
} as const;

export function formatRupiah(n: number | null): string {
  return n === null ? UNKNOWN : `Rp${NBSP}${integer.format(n)}`;
}

/** `fraction` is the API's change ratio (0.028 = 2.8%). */
export function formatChange(fraction: number | null, digits = 1): string {
  if (fraction === null) return UNKNOWN;
  return percent(digits).format(fraction).replace('-', MINUS).replace(/\s/g, '');
}

/** Changes that display as 0,0% are "flat", so the arrow never contradicts the number. */
export function changeDirection(fraction: number | null): 'up' | 'down' | 'flat' | null {
  if (fraction === null) return null;
  if (Math.abs(fraction) < 0.0005) return 'flat';
  return fraction > 0 ? 'up' : 'down';
}

const DATE_ONLY = /^(\d{4})-(\d{2})-(\d{2})$/;

/**
 * Calendar dates (`YYYY-MM-DD`) are WIB calendar days and are shown as-is; timestamps are
 * converted to Asia/Jakarta.
 */
export function formatDateWib(iso: string, style: 'short' | 'long'): string {
  const m = DATE_ONLY.exec(iso);
  // Noon UTC is 19:00 WIB on the same calendar day, so no zone shift can move the date.
  const date = m
    ? new Date(Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3]), 12))
    : new Date(iso);
  if (Number.isNaN(date.getTime())) return UNKNOWN;
  return dateFormats[style].format(date);
}

const HORIZON_LABELS: Record<Horizon, { short: string; long: string }> = {
  1: { short: '1H', long: '1 hari' },
  3: { short: '3H', long: '3 hari' },
  7: { short: '7H', long: '7 hari' },
  14: { short: '14H', long: '14 hari' },
  30: { short: '30H', long: '30 hari' },
  90: { short: '90H', long: '90 hari' },
  180: { short: '6B', long: '6 bulan' },
  365: { short: '1T', long: '1 tahun' },
};

export function formatHorizon(days: Horizon): { short: string; long: string } {
  return HORIZON_LABELS[days];
}

/** "52 rb", "13,7 rb", "1,25 jt" (axis labels; exact values live in tooltips and tables). */
export function compactRupiah(n: number): string {
  const fmt = (v: number, digits: number): string =>
    v.toLocaleString('id-ID', { maximumFractionDigits: digits });
  if (Math.abs(n) >= 1_000_000) return `${fmt(n / 1_000_000, 2)} jt`;
  if (Math.abs(n) >= 1_000) {
    const k = n / 1_000;
    return `${fmt(k, Math.abs(k) >= 20 ? 0 : 1)} rb`;
  }
  return fmt(n, 0);
}
