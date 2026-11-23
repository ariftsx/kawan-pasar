/** Series logic of Mode Analis (Fase 3A): pure, shared by the server page and the chart. */

export interface DayPrice {
  day: string; // YYYY-MM-DD
  price: number;
}

export interface DayValue {
  day: string;
  value: number;
}

export type AnalystRange = '90h' | '1t' | '3t' | 'semua';
export type AnalystMetric = 'indeks' | 'harga' | 'perubahan';

export const RANGES: readonly { id: AnalystRange; label: string; days: number | null }[] = [
  { id: '90h', label: '90H', days: 90 },
  { id: '1t', label: '1T', days: 365 },
  { id: '3t', label: '3T', days: 3 * 365 },
  { id: 'semua', label: 'Semua', days: null },
];

export const METRICS: readonly { id: AnalystMetric; label: string }[] = [
  { id: 'indeks', label: 'Indeks (awal = 100)' },
  { id: 'harga', label: 'Harga (Rp/kg)' },
  { id: 'perubahan', label: 'Perubahan relatif (%)' },
];

/**
 * The coarse (whole history, downsampled by the API) series before the first daily point, then
 * the daily series of the last year: small to send, exact where people zoom in.
 */
export function mergeHistory(
  coarse: readonly { observedOn: string; priceIdr: number }[],
  daily: readonly { observedOn: string; priceIdr: number }[],
): DayPrice[] {
  const firstDaily = daily[0]?.observedOn;
  const head = coarse.filter((x) => firstDaily === undefined || x.observedOn < firstDaily);
  return [...head, ...daily].map((x) => ({ day: x.observedOn, price: x.priceIdr }));
}

const DAY_MS = 86_400_000;

/** Points within the range, counted back from `latest` (the newest day across the series). */
export function withinRange(
  s: readonly DayPrice[],
  range: AnalystRange,
  latest: string,
): DayPrice[] {
  const days = RANGES.find((r) => r.id === range)?.days ?? null;
  if (days === null) return [...s];
  const from = new Date(Date.parse(`${latest}T00:00:00Z`) - days * DAY_MS)
    .toISOString()
    .slice(0, 10);
  return s.filter((x) => x.day >= from);
}

const round4 = (v: number): number => Math.round(v * 1e4) / 1e4;

export function transform(s: readonly DayPrice[], metric: AnalystMetric): DayValue[] {
  const base = s[0]?.price;
  if (base === undefined) return [];
  return s.map((x) => ({
    day: x.day,
    value:
      metric === 'harga'
        ? x.price
        : metric === 'indeks'
          ? round4((x.price / base) * 100)
          : round4((x.price / base - 1) * 100),
  }));
}

/** A series as sent to the browser: first day, then day gaps and prices (about 4× smaller). */
export interface CompactSeries {
  start: string | null;
  gaps: number[];
  prices: number[];
}

const dayNumber = (d: string): number => Math.round(Date.parse(`${d}T00:00:00Z`) / DAY_MS);
const dayString = (n: number): string => new Date(n * DAY_MS).toISOString().slice(0, 10);

export function encodeSeries(s: readonly DayPrice[]): CompactSeries {
  const first = s[0];
  if (first === undefined) return { start: null, gaps: [], prices: [] };
  const gaps: number[] = [];
  for (let i = 1; i < s.length; i += 1) {
    gaps.push(dayNumber(s[i]?.day ?? first.day) - dayNumber(s[i - 1]?.day ?? first.day));
  }
  return { start: first.day, gaps, prices: s.map((x) => x.price) };
}

export function decodeSeries(c: CompactSeries): DayPrice[] {
  if (c.start === null) return [];
  let n = dayNumber(c.start);
  return c.prices.map((price, i) => {
    if (i > 0) n += c.gaps[i - 1] ?? 0;
    return { day: dayString(n), price };
  });
}
