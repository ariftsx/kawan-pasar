import type { EvalStatus, ForecastHorizon, ForecastResponse } from '@kawan-pasar/contracts';
import {
  UNKNOWN,
  compactRupiah,
  changeDirection,
  formatChange,
  formatDateWib,
  formatHorizon,
  formatRupiah,
} from '../format';

const EVAL: Record<EvalStatus, string> = {
  available: 'Tersedia',
  partial: 'Sebagian',
  not_tested: 'Belum diuji',
};

export interface ForecastRow {
  horizonDays: number;
  label: string;
  short: string;
  target: string;
  change: string;
  direction: 'up' | 'down' | 'flat' | null;
  price: string;
  range: string;
  /** "55,5–73,7 rb" for small cards. */
  rangeCompact: string;
  eval: string;
}

export interface ForecastView {
  /** Product rule: numbers only for available/expired forecasts. */
  showNumbers: boolean;
  /** Labels that must accompany the numbers ("Kedaluwarsa", "Data demo"). */
  labels: string[];
  rows: ForecastRow[];
}

/**
 * Which empty state explains a forecast without numbers: "coming in a later phase" only for
 * commodities the model does not cover yet; otherwise it is unavailable (hidden, missing).
 */
export function noForecastKind(
  status: ForecastResponse['status'],
): 'forecast_pending' | 'forecast_unavailable' {
  return status === 'pending_coverage' ? 'forecast_pending' : 'forecast_unavailable';
}

/** Display rows for the given horizons (unknown quantiles shown as "—"). */
export function horizonRows(horizons: readonly ForecastHorizon[]): ForecastRow[] {
  return horizons.map((h): ForecastRow => {
    const dir = changeDirection(h.q50Change);
    const { long, short } = formatHorizon(h.horizonDays);
    return {
      horizonDays: h.horizonDays,
      label: long,
      short,
      target: formatDateWib(h.targetDate, 'short'),
      change:
        h.q50Change === null ? UNKNOWN : dir === 'flat' ? 'stabil' : formatChange(h.q50Change),
      direction: dir,
      price: formatRupiah(h.q50PriceIdr),
      range:
        h.q10PriceIdr === null || h.q90PriceIdr === null
          ? UNKNOWN
          : `${formatRupiah(h.q10PriceIdr)} – ${formatRupiah(h.q90PriceIdr)}`,
      rangeCompact:
        h.q10PriceIdr === null || h.q90PriceIdr === null
          ? UNKNOWN
          : `${compactRupiah(h.q10PriceIdr).replace(' rb', '')}–${compactRupiah(h.q90PriceIdr)}`,
      eval: EVAL[h.evalStatus],
    };
  });
}

export function forecastView(f: ForecastResponse): ForecastView {
  const showNumbers = (f.status === 'available' || f.status === 'expired') && f.artifact !== null;
  if (!showNumbers) return { showNumbers: false, labels: [], rows: [] };
  const labels = [
    ...(f.status === 'expired' ? ['Kedaluwarsa'] : []),
    ...(f.artifact?.isDemo === true ? ['Data demo'] : []),
  ];
  const rows = horizonRows(f.horizons);
  return { showNumbers, labels, rows };
}
