import type { PricePoint } from '@kawan-pasar/contracts';
import { compactRupiah } from '@/lib/format';

export { compactRupiah };

/** Chart geometry (viewBox units). Labels are HTML around the SVG, so they never scale. */
export const VIEW = { width: 640, height: 220, padTop: 10, padBottom: 10 } as const;

const DAY_MS = 86_400_000;
const dayNumber = (iso: string): number => Date.parse(`${iso}T00:00:00Z`) / DAY_MS;

export const addDays = (iso: string, days: number): string =>
  new Date((dayNumber(iso) + days) * DAY_MS).toISOString().slice(0, 10);

/** Calendar-date scale. A zero-length domain maps everything to the middle. */
export function timeScale(
  domain: [string, string],
  range: [number, number],
): (iso: string) => number {
  const d0 = dayNumber(domain[0]);
  const span = dayNumber(domain[1]) - d0;
  const [r0, r1] = range;
  return (iso) => (span === 0 ? (r0 + r1) / 2 : r0 + ((dayNumber(iso) - d0) / span) * (r1 - r0));
}

/**
 * Linear scale with 8% headroom. A flat series (min = max) gets a ±5% domain around its value,
 * so it is drawn as a level line in the middle instead of dividing by zero.
 */
export function linearScale(
  [min, max]: [number, number],
  [r0, r1]: [number, number],
): { scale: (v: number) => number; domain: [number, number] } {
  let lo = min;
  let hi = max;
  if (hi - lo === 0) {
    const pad = Math.abs(lo) * 0.05 || 1;
    lo -= pad;
    hi += pad;
  } else {
    const pad = (hi - lo) * 0.08;
    lo -= pad;
    hi += pad;
  }
  return { scale: (v) => r0 + ((v - lo) / (hi - lo)) * (r1 - r0), domain: [lo, hi] };
}

/** SVG path through the points (no interpolation across gaps). Empty with fewer than 2 points. */
export function pathFrom(
  points: readonly PricePoint[],
  x: (iso: string) => number,
  y: (v: number) => number,
): string {
  if (points.length < 2) return '';
  const parts: string[] = [];
  for (const p of points) {
    const px = x(p.observedOn);
    const py = y(p.priceIdr);
    if (!Number.isFinite(px) || !Number.isFinite(py)) continue;
    parts.push(`${parts.length === 0 ? 'M' : 'L'}${px.toFixed(1)} ${py.toFixed(1)}`);
  }
  return parts.length < 2 ? '' : parts.join(' ');
}

/** About 3 "nice" price ticks inside the domain (steps of 1, 2 or 5 × 10^k). */
export function priceTicks([lo, hi]: [number, number], count = 3): number[] {
  const raw = (hi - lo) / count;
  if (!(raw > 0)) return [lo];
  const mag = 10 ** Math.floor(Math.log10(raw));
  const step = [1, 2, 5, 10].map((m) => m * mag).find((s) => s >= raw) ?? 10 * mag;
  const ticks: number[] = [];
  for (let v = Math.ceil(lo / step) * step; v <= hi; v += step) ticks.push(v);
  return ticks;
}

/** Evenly spaced date ticks between two days (inclusive). */
export function dateTicks(from: string, to: string, count = 4): string[] {
  const d0 = dayNumber(from);
  const span = dayNumber(to) - d0;
  if (span <= 0) return [from];
  const ticks = Array.from({ length: count }, (_, i) =>
    addDays(from, Math.round((span * i) / (count - 1))),
  );
  return [...new Set(ticks)];
}

export type RangeKey = '30d' | '90d' | '365d' | 'all';
export const RANGE_KEYS: readonly RangeKey[] = ['30d', '90d', '365d', 'all'];
export const RANGE_LABEL: Record<RangeKey, { short: string; long: string; days: number | null }> = {
  '30d': { short: '30H', long: '30 hari', days: 30 },
  '90d': { short: '90H', long: '90 hari', days: 90 },
  '365d': { short: '1T', long: '1 tahun', days: 365 },
  all: { short: 'Semua', long: 'semua data', days: null },
};

/** The four ranges, cut relative to the latest observation of the 1-year series. */
export function rangeSlices(
  points365: readonly PricePoint[],
  pointsAll: readonly PricePoint[],
): Record<RangeKey, readonly PricePoint[]> {
  const latest = points365.at(-1)?.observedOn;
  const since = (days: number): readonly PricePoint[] => {
    if (latest === undefined) return [];
    const cutoff = addDays(latest, -days);
    return points365.filter((p) => p.observedOn > cutoff);
  };
  return { '30d': since(30), '90d': since(90), '365d': points365, all: pointsAll };
}
