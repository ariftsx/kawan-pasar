import type { PricePoint } from '@kawan-pasar/contracts';

const DAY_MS = 86_400_000;

const shift = (iso: string, days: number): string =>
  new Date(Date.parse(`${iso}T00:00:00Z`) - days * DAY_MS).toISOString().slice(0, 10);

/**
 * Change of the latest observation against the last observation on or before `days` calendar
 * days earlier (no interpolation across gaps), with the date it was compared to. `null` when
 * there is no such observation.
 */
export function changeWithReference(
  points: readonly PricePoint[],
  days: number,
): { change: number; since: string } | null {
  const latest = points.at(-1);
  if (latest === undefined) return null;
  const reference = shift(latest.observedOn, days);
  let base: PricePoint | undefined;
  for (const p of points) {
    if (p.observedOn <= reference) base = p;
    else break;
  }
  if (base === undefined || base.priceIdr === 0) return null;
  return { change: latest.priceIdr / base.priceIdr - 1, since: base.observedOn };
}

export function changesFromHistory(points: readonly PricePoint[], days: number): number | null {
  return changeWithReference(points, days)?.change ?? null;
}
