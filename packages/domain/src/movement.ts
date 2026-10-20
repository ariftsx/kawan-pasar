/**
 * Statistical "unusual movement" threshold (docs 05 §4.1, decision D-22).
 *
 * Δ7d(t) = p_t / p_{t−7} − 1, where p_{t−7} is the latest observation on or before t−7, looking
 * back at most 7 more calendar days. Missing days are never filled. q95 is the linear-interpolated
 * 0.95 quantile of |Δ7d| over every t strictly before the calculation date (no future data).
 */
import { err, ok, type Result } from './result.js';

export type PricePoint = {
  /** Market date, `YYYY-MM-DD` (WIB). */
  readonly date: string;
  readonly priceIdr: number;
};

export type WeeklyChange = { readonly date: string; readonly change: number };

export type MovementThreshold =
  | {
      readonly status: 'available';
      readonly q95AbsChange: number;
      readonly nObs: number;
      readonly windowEnd: string;
    }
  | { readonly status: 'insufficient_coverage'; readonly nObs: number };

export const CHANGE_HORIZON_DAYS = 7;
export const LOOKBACK_TOLERANCE_DAYS = 7;
export const MIN_THRESHOLD_OBSERVATIONS = 250;
export const THRESHOLD_QUANTILE = 0.95;

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;
const MS_PER_DAY = 86_400_000;

/** Days since the Unix epoch, or `null` when the string is not a real calendar date. */
export function toDayNumber(date: string): number | null {
  if (!ISO_DATE.test(date)) return null;
  const time = Date.parse(`${date}T00:00:00Z`);
  if (Number.isNaN(time)) return null;
  // Some engines roll 2026-02-30 over to March instead of failing; the round trip rejects it.
  return new Date(time).toISOString().slice(0, 10) === date ? time / MS_PER_DAY : null;
}

type IndexedPoint = { readonly day: number; readonly date: string; readonly priceIdr: number };
type IndexedChange = WeeklyChange & { readonly day: number };

function indexSeries(points: readonly PricePoint[]): Result<IndexedPoint[]> {
  const indexed: IndexedPoint[] = [];
  for (const point of points) {
    const day = toDayNumber(point.date);
    if (day === null) return err('INVALID_DATE', `Tanggal tidak valid: ${point.date}.`);
    if (!Number.isSafeInteger(point.priceIdr) || point.priceIdr <= 0) {
      return err('INVALID_PRICE', `Harga pada ${point.date} harus rupiah bulat > 0.`);
    }
    const previous = indexed.at(-1);
    if (previous !== undefined && previous.day >= day) {
      return err('UNSORTED_SERIES', 'Seri harga harus urut naik tanpa tanggal ganda.');
    }
    indexed.push({ day, date: point.date, priceIdr: point.priceIdr });
  }
  return ok(indexed);
}

const MAX_REFERENCE_DISTANCE = CHANGE_HORIZON_DAYS + LOOKBACK_TOLERANCE_DAYS;

/**
 * Latest earlier point with day in [target − tolerance, target]. Dates are unique and sorted, so it
 * can only be among the previous `MAX_REFERENCE_DISTANCE` entries.
 */
function findReference(series: readonly IndexedPoint[], index: number, targetDay: number) {
  const recent = series.slice(Math.max(0, index - MAX_REFERENCE_DISTANCE), index).reverse();
  return (
    recent.find(
      (candidate) =>
        candidate.day <= targetDay && candidate.day >= targetDay - LOOKBACK_TOLERANCE_DAYS,
    ) ?? null
  );
}

function weeklyChanges(series: readonly IndexedPoint[]): IndexedChange[] {
  const changes: IndexedChange[] = [];
  series.forEach((point, index) => {
    const reference = findReference(series, index, point.day - CHANGE_HORIZON_DAYS);
    if (reference !== null) {
      const change = point.priceIdr / reference.priceIdr - 1;
      changes.push({ day: point.day, date: point.date, change });
    }
  });
  return changes;
}

/** Every computable Δ7d in the series, in date order. */
export function computeWeeklyChanges(points: readonly PricePoint[]): Result<WeeklyChange[]> {
  const series = indexSeries(points);
  if (!series.ok) return series;
  return ok(weeklyChanges(series.value).map(({ date, change }) => ({ date, change })));
}

/** Linear-interpolated quantile (same as `numpy.quantile` default); `NaN` for an empty list. */
export function quantileSorted(sorted: readonly number[], probability: number): number {
  const position = (sorted.length - 1) * probability;
  const lower = Math.floor(position);
  const [lowerValue = Number.NaN, upperValue = lowerValue] = sorted.slice(lower, lower + 2);
  return lowerValue + (upperValue - lowerValue) * (position - lower);
}

export type ThresholdOptions = {
  /** Defaults to {@link MIN_THRESHOLD_OBSERVATIONS}. */
  readonly minObservations?: number;
};

/** Threshold from all Δ7d with date strictly before `asOf`. */
export function computeMovementThreshold(
  points: readonly PricePoint[],
  asOf: string,
  { minObservations = MIN_THRESHOLD_OBSERVATIONS }: ThresholdOptions = {},
): Result<MovementThreshold> {
  const asOfDay = toDayNumber(asOf);
  if (asOfDay === null) return err('INVALID_DATE', `Tanggal hitung tidak valid: ${asOf}.`);
  const series = indexSeries(points);
  if (!series.ok) return series;

  const window = weeklyChanges(series.value).filter((item) => item.day < asOfDay);
  const last = window.at(-1);
  if (window.length < minObservations || last === undefined) {
    return ok({ status: 'insufficient_coverage', nObs: window.length });
  }
  const sorted = window.map((item) => Math.abs(item.change)).sort((a, b) => a - b);
  return ok({
    status: 'available',
    q95AbsChange: quantileSorted(sorted, THRESHOLD_QUANTILE),
    nObs: window.length,
    windowEnd: last.date,
  });
}

/** True only when a threshold exists and |Δ7d| is strictly above it. */
export function isUnusualMovement(change: number, threshold: MovementThreshold): boolean {
  return threshold.status === 'available' && Math.abs(change) > threshold.q95AbsChange;
}
