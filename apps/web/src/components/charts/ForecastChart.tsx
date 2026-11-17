import type { ForecastHorizon, PricePoint } from '@kawan-pasar/contracts';
import type { ReactNode } from 'react';
import { formatDateWib, formatRupiah } from '@/lib/format';
import './charts.css';
import { horizonRows } from '@/lib/insights/forecast-view';
import { ChartTooltip } from './ChartTooltip';
import { ForecastTable } from './ForecastTable';
import type { TooltipPoint } from './ChartTooltip';
import {
  VIEW,
  addDays,
  compactRupiah,
  dateTicks,
  linearScale,
  pathFrom,
  pct,
  priceTicks,
  timeScale,
} from './scale';

interface Known {
  h: ForecastHorizon;
  q10: number;
  q50: number;
  q90: number;
}

/** Horizons whose three quantile prices are known (unknown ones are never drawn). */
function knownHorizons(horizons: readonly ForecastHorizon[]): Known[] {
  return horizons.flatMap((h) =>
    h.q10PriceIdr === null || h.q50PriceIdr === null || h.q90PriceIdr === null
      ? []
      : [{ h, q10: h.q10PriceIdr, q50: h.q50PriceIdr, q90: h.q90PriceIdr }],
  );
}

function Variant({
  scale,
  actual,
  baseDate,
  basePriceIdr,
  known,
}: {
  scale: 'short' | 'long';
  actual: readonly PricePoint[];
  baseDate: string;
  basePriceIdr: number;
  known: readonly Known[];
}): ReactNode {
  const end = addDays(baseDate, scale === 'short' ? 30 : 365);
  const start = actual[0]?.observedOn ?? addDays(baseDate, -60);
  const shown = known.filter((k) => k.h.targetDate <= end);
  const values = [
    ...actual.map((p) => p.priceIdr),
    basePriceIdr,
    ...shown.flatMap((k) => [k.q10, k.q90]),
  ];
  const x = timeScale([start, end], [0, VIEW.width]);
  const y = linearScale(
    [Math.min(...values), Math.max(...values)],
    [VIEW.height - VIEW.padBottom, VIEW.padTop],
  );
  const base = { x: x(baseDate), y: y.scale(basePriceIdr) };
  const at = (k: Known, v: number): string =>
    `${x(k.h.targetDate).toFixed(1)} ${y.scale(v).toFixed(1)}`;
  const median =
    shown.length === 0
      ? ''
      : `M${base.x.toFixed(1)} ${base.y.toFixed(1)} ${shown.map((k) => `L${at(k, k.q50)}`).join(' ')}`;
  const band =
    shown.length === 0
      ? ''
      : `M${base.x.toFixed(1)} ${base.y.toFixed(1)} ${shown.map((k) => `L${at(k, k.q90)}`).join(' ')} ${[
          ...shown,
        ]
          .reverse()
          .map((k) => `L${at(k, k.q10)}`)
          .join(' ')} Z`;
  const yTicks = priceTicks(y.domain);
  const tooltip: TooltipPoint[] = [
    ...actual.map((p): TooltipPoint => [
      pct(x(p.observedOn), VIEW.width),
      pct(y.scale(p.priceIdr), VIEW.height),
      `${formatDateWib(p.observedOn, 'short')} · aktual`,
      formatRupiah(p.priceIdr),
    ]),
    ...shown.map((k): TooltipPoint => [
      pct(x(k.h.targetDate), VIEW.width),
      pct(y.scale(k.q50), VIEW.height),
      `${formatDateWib(k.h.targetDate, 'short')} · perkiraan`,
      `${formatRupiah(k.q50)} (${compactRupiah(k.q10)}–${compactRupiah(k.q90)})`,
    ]),
  ];
  return (
    <div data-scale={scale}>
      <div className="flex gap-2">
        <div
          aria-hidden="true"
          className="relative w-11 shrink-0 text-right text-[11px] text-muted-text"
        >
          {yTicks.map((t) => (
            <span
              key={t}
              className="tabular absolute right-0 -translate-y-1/2"
              style={{ top: `${String(pct(y.scale(t), VIEW.height))}%` }}
            >
              {compactRupiah(t)}
            </span>
          ))}
        </div>
        <div className="relative min-w-0 flex-1">
          <svg
            viewBox={`0 0 ${String(VIEW.width)} ${String(VIEW.height)}`}
            preserveAspectRatio="none"
            aria-hidden="true"
            focusable="false"
            className="block h-[220px] w-full"
          >
            {yTicks.map((t) => (
              <line
                key={t}
                x1={0}
                x2={VIEW.width}
                y1={y.scale(t)}
                y2={y.scale(t)}
                className="stroke-line"
                strokeWidth={1}
                vectorEffect="non-scaling-stroke"
              />
            ))}
            {band === '' ? null : (
              <path data-series="band" d={band} className="fill-terong-100" opacity={0.85} />
            )}
            <line
              data-series="base"
              x1={base.x}
              x2={base.x}
              y1={0}
              y2={VIEW.height}
              className="stroke-muted"
              strokeWidth={1}
              strokeDasharray="4 4"
              vectorEffect="non-scaling-stroke"
            />
            <path
              data-series="actual"
              d={pathFrom(actual, x, y.scale)}
              fill="none"
              className="stroke-ink"
              strokeWidth={2.25}
              strokeLinejoin="round"
              vectorEffect="non-scaling-stroke"
            />
            {median === '' ? null : (
              <path
                data-series="median"
                d={median}
                fill="none"
                className="stroke-terong-600"
                strokeWidth={2.25}
                strokeDasharray="6 5"
                vectorEffect="non-scaling-stroke"
              />
            )}
          </svg>
          {shown.map((k) => (
            <span
              key={k.h.horizonDays}
              data-h={String(k.h.horizonDays)}
              aria-hidden="true"
              className="absolute size-3 -translate-x-1/2 -translate-y-1/2 rounded-full bg-terong-600"
              style={{
                left: `${String(pct(x(k.h.targetDate), VIEW.width))}%`,
                top: `${String(pct(y.scale(k.q50), VIEW.height))}%`,
              }}
            />
          ))}
          <ChartTooltip points={tooltip} label="Telusuri harga aktual dan perkiraan" />
        </div>
      </div>
      <div
        aria-hidden="true"
        className="ml-[3.25rem] flex justify-between pt-2 text-[11px] text-muted-text"
      >
        {dateTicks(start, end).map((t) => (
          <span key={t}>{formatDateWib(t, 'short').replace(/^\w+, /, '')}</span>
        ))}
      </div>
    </div>
  );
}

/**
 * Forecast chart (v0.4 "Grafik prediksi"): actual prices (solid), the median forecast (dashed),
 * the 80% range (q10–q90, shaded) and the base day. Two time axes (≤ 30 days, ≤ 1 year) are
 * rendered; the active horizon selects one (charts.css). Only render it when the forecast may
 * show numbers (forecastView().showNumbers).
 */
export function ForecastChart({
  id,
  actual,
  baseDate,
  basePriceIdr,
  horizons,
  defaultHorizon = 7,
  table = 'details',
  before,
  children,
}: {
  id: string;
  actual: readonly PricePoint[];
  baseDate: string;
  basePriceIdr: number;
  horizons: readonly ForecastHorizon[];
  defaultHorizon?: number;
  /** Horizon table: visible ('open', forecast page) or collapsed in <details> (elsewhere). */
  table?: 'open' | 'details';
  /** Horizon-dependent blocks rendered by the page above the chart (metric cards). */
  before?: ReactNode;
  /** Horizon-dependent blocks rendered by the page (metric cards, table). */
  children?: ReactNode;
}): ReactNode {
  const known = knownHorizons(horizons);
  const rows = horizonRows(horizons);
  const recent = actual.filter(
    (p) => p.observedOn >= addDays(baseDate, -60) && p.observedOn <= baseDate,
  );
  return (
    <div id={id} data-active-horizon={String(defaultHorizon)} className="min-w-0">
      {before}
      {/* Text alternative of the chart for the active horizon (charts.css shows one). */}
      {rows
        .filter((r) => r.price !== '—')
        .map((r) => (
          <p
            key={r.horizonDays}
            data-horizon-only={String(r.horizonDays)}
            className="mb-3 text-body-small-13 text-ink-2"
          >
            Perkiraan median {r.label}: <strong>{r.price}</strong> pada {r.target} ({r.change});
            rentang kemungkinan 80% {r.range}.
          </p>
        ))}
      <Variant
        scale="short"
        actual={recent}
        baseDate={baseDate}
        basePriceIdr={basePriceIdr}
        known={known}
      />
      <Variant
        scale="long"
        actual={recent}
        baseDate={baseDate}
        basePriceIdr={basePriceIdr}
        known={known}
      />
      <ul aria-hidden="true" className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-[12px] text-ink-2">
        <li className="flex items-center gap-1.5">
          <span className="h-0.5 w-4 bg-ink" />
          Harga aktual
        </li>
        <li className="flex items-center gap-1.5">
          <span className="h-0.5 w-4 border-t-2 border-dashed border-terong-600" />
          Prediksi (estimasi)
        </li>
        <li className="flex items-center gap-1.5">
          <span className="h-2.5 w-4 rounded-sm bg-terong-100" />
          Rentang kemungkinan (80%)
        </li>
        <li className="flex items-center gap-1.5">
          <span className="h-3 w-0 border-l border-dashed border-muted" />
          Hari dasar
        </li>
      </ul>
      {table === 'open' ? (
        <ForecastTable rows={rows} />
      ) : (
        <details className="mt-4 text-body-small-13">
          <summary className="inline-flex min-h-11 cursor-pointer items-center font-semibold text-green-900">
            Lihat semua horizon dalam tabel
          </summary>
          <ForecastTable rows={rows} />
        </details>
      )}
      {children}
    </div>
  );
}
