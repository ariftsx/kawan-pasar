import type { AlertDirection } from '@kawan-pasar/contracts';

/**
 * The three alert rules of the prototype (d_peringatan) as pure functions, and the wording of
 * the news they produce. Wording follows the product's language rules: facts and numbers only,
 * no causes and no buying or selling advice.
 */

/** One observation: `day` = days since 1970-01-01 (UTC), price in rupiah per kg. */
export interface Point {
  day: number;
  price: number;
}

/** How far back the "usual" range of 7-day changes looks (same window as the demo bundle). */
export const USUAL_LOOKBACK_DAYS = 730;
/** Fewer 7-day changes than this: no claim about what is usual. */
export const USUAL_MIN_SAMPLES = 60;
export const USUAL_PERCENTILE = 0.9;
/** "Prediksi naik lebih dari 2 %": on the median, 7 days ahead first, else 30 days. */
export const FORECAST_RISE_MIN = 0.02;
export const FORECAST_RISE_HORIZONS = [7, 30] as const;

/** Index of the last point with day ≤ target (points ascending), or -1. */
function lastAtOrBefore(points: readonly Point[], target: number): number {
  let lo = 0;
  let hi = points.length - 1;
  let found = -1;
  while (lo <= hi) {
    const mid = (lo + hi) >> 1;
    if ((points[mid]?.day ?? Infinity) <= target) {
      found = mid;
      lo = mid + 1;
    } else hi = mid - 1;
  }
  return found;
}

function changeAt(points: readonly Point[], i: number): number | null {
  const now = points[i];
  if (now === undefined) return null;
  const j = lastAtOrBefore(points, now.day - 7);
  const before = j >= 0 ? points[j] : undefined;
  return before === undefined ? null : now.price / before.price - 1;
}

/** Change of the last price against the last price on or before 7 days earlier. */
export function sevenDayChange(points: readonly Point[]): number | null {
  return changeAt(points, points.length - 1);
}

/** 90th percentile of |7-day change| over the look-back window (excluding the last day). */
export function usualSevenDayRange(points: readonly Point[]): number | null {
  const last = points.at(-1);
  if (last === undefined) return null;
  const moves: number[] = [];
  for (let i = 0; i < points.length - 1; i += 1) {
    if ((points[i]?.day ?? 0) < last.day - USUAL_LOOKBACK_DAYS) continue;
    const c = changeAt(points, i);
    if (c !== null) moves.push(Math.abs(c));
  }
  if (moves.length < USUAL_MIN_SAMPLES) return null;
  moves.sort((a, b) => a - b);
  const pos = (moves.length - 1) * USUAL_PERCENTILE;
  const lo = Math.floor(pos);
  const a = moves[lo] ?? 0;
  const b = moves[Math.ceil(pos)] ?? a;
  return a + (b - a) * (pos - lo);
}

export interface UnusualMove {
  change: number;
  usual: number;
  direction: 'up' | 'down';
}

export function unusualMove(points: readonly Point[]): UnusualMove | null {
  const change = sevenDayChange(points);
  const usual = usualSevenDayRange(points);
  if (change === null || usual === null || usual <= 0) return null;
  if (Math.abs(change) <= usual) return null;
  return { change, usual, direction: change > 0 ? 'up' : 'down' };
}

/** The price moved past the limit between the previous and the latest observation. */
export function crossed(
  previous: number,
  latest: number,
  threshold: number,
  direction: AlertDirection,
): boolean {
  return direction === 'above'
    ? previous <= threshold && latest > threshold
    : previous >= threshold && latest < threshold;
}

export interface ForecastPoint {
  horizonDays: number;
  q10Change: number | null;
  q50Change: number | null;
  q90Change: number | null;
  q10PriceIdr: number | null;
  q50PriceIdr: number | null;
  q90PriceIdr: number | null;
}

export function forecastRise(horizons: readonly ForecastPoint[]): ForecastPoint | null {
  for (const h of FORECAST_RISE_HORIZONS) {
    const f = horizons.find((x) => x.horizonDays === h);
    if (f !== undefined && f.q50Change !== null && f.q50Change > FORECAST_RISE_MIN) return f;
  }
  return null;
}

// --- wording -------------------------------------------------------------------------------

export interface News {
  title: string;
  body: string;
}

const rupiah = (v: number): string => `Rp ${Math.round(v).toLocaleString('id-ID')}`;
const percent = (v: number): string =>
  `${(Math.abs(v) * 100).toLocaleString('id-ID', { minimumFractionDigits: 1, maximumFractionDigits: 1 })}%`;
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'Mei', 'Jun', 'Jul', 'Agu', 'Sep', 'Okt', 'Nov', 'Des'];
/** "30 Sep 2026" from YYYY-MM-DD (a calendar date; no time zone involved). */
export const shortDate = (iso: string): string => {
  const [y, m, d] = iso.split('-');
  return `${String(Number(d))} ${MONTHS[Number(m) - 1] ?? ''} ${y ?? ''}`;
};
const lowerFirst = (s: string): string => s.charAt(0).toLowerCase() + s.slice(1);

export function unusualMoveNews(x: {
  commodityName: string;
  marketName: string;
  price: number;
  change: number;
  usual: number;
  dataDate: string;
}): News {
  const verb = x.change > 0 ? 'naik' : 'turun';
  return {
    title: `${x.commodityName} ${verb} ${percent(x.change)} dalam 7 hari`,
    body: `${rupiah(x.price)}/kg di ${x.marketName} (data ${shortDate(x.dataDate)}). Perubahan 7 hari biasanya tidak lebih dari ${percent(x.usual)}.`,
  };
}

export function forecastRiseNews(x: {
  commodityName: string;
  horizonDays: number;
  q50Change: number;
  q10PriceIdr: number | null;
  q50PriceIdr: number | null;
  q90PriceIdr: number | null;
  modelVersion: string;
  dataDate: string;
}): News {
  const range =
    x.q10PriceIdr !== null && x.q90PriceIdr !== null
      ? ` (rentang ${rupiah(x.q10PriceIdr)}–${rupiah(x.q90PriceIdr)})`
      : '';
  const price = x.q50PriceIdr === null ? '' : `Perkiraan ${rupiah(x.q50PriceIdr)}/kg${range}. `;
  return {
    title: `Prediksi: ${lowerFirst(x.commodityName)} naik ${percent(x.q50Change)} dalam ${String(x.horizonDays)} hari`,
    body: `${price}Estimasi ARIF-Net ${x.modelVersion}, data sampai ${shortDate(x.dataDate)}; bukan jaminan harga.`,
  };
}

export function thresholdNews(x: {
  commodityName: string;
  marketName: string;
  previous: number;
  price: number;
  threshold: number;
  direction: AlertDirection;
  dataDate: string;
}): News {
  const where = x.direction === 'above' ? 'di atas' : 'di bawah';
  return {
    title: `${x.commodityName} ${where} batas Anda (${rupiah(x.threshold)}/kg)`,
    body: `${rupiah(x.price)}/kg di ${x.marketName} pada ${shortDate(x.dataDate)}, sebelumnya ${rupiah(x.previous)}/kg.`,
  };
}
