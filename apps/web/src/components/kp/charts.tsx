import { cn } from '@kawan-pasar/ui';

import { formatDayMonth, formatRupiah } from '@/lib/format';

import type { PricePoint } from '@/lib/market/demo-series';

// Line charts drawn as plain SVG (no chart library). Observed prices are a solid line; forecasts
// are dashed with a hollow marker, so the boundary never relies on colour (docs 10 §6).

const W = 640;

type Box = {
  readonly height: number;
  readonly left: number;
  readonly right: number;
  readonly top: number;
  readonly bottom: number;
};

function toTime(date: string): number {
  return Date.parse(`${date}T00:00:00Z`);
}

function scale(points: readonly PricePoint[], box: Box) {
  const times = points.map((point) => toTime(point.date));
  const prices = points.map((point) => point.price);
  const t0 = Math.min(...times);
  const t1 = Math.max(...times);
  const lo = Math.min(...prices);
  const hi = Math.max(...prices);
  const pad = Math.max((hi - lo) * 0.12, hi * 0.01);
  const y0 = lo - pad;
  const y1 = hi + pad;
  return {
    x: (date: string) =>
      box.left + ((toTime(date) - t0) / Math.max(1, t1 - t0)) * (W - box.left - box.right),
    y: (price: number) =>
      box.top + (1 - (price - y0) / (y1 - y0)) * (box.height - box.top - box.bottom),
    y0,
    y1,
  };
}

function path(points: readonly PricePoint[], x: (d: string) => number, y: (p: number) => number) {
  return points
    .map(
      (point, i) =>
        `${i === 0 ? 'M' : 'L'}${x(point.date).toFixed(1)} ${y(point.price).toFixed(1)}`,
    )
    .join(' ');
}

function thousands(price: number): string {
  return `${new Intl.NumberFormat('id-ID', { maximumFractionDigits: 1 }).format(price / 1000)} rb`;
}

/** Compact trend line for tables and cards; decorative (the numbers sit next to it). */
export function Sparkline({
  points,
  className,
}: {
  readonly points: readonly PricePoint[];
  readonly className?: string;
}) {
  if (points.length < 2) return <span className="text-text-muted">—</span>;
  const box: Box = { height: 48, left: 2, right: 2, top: 4, bottom: 4 };
  const { x, y } = scale(points, box);
  return (
    <svg
      viewBox={`0 0 ${String(W)} 48`}
      preserveAspectRatio="none"
      aria-hidden
      className={cn('h-8 w-32', className)}
    >
      <path
        d={path(points, x, y)}
        fill="none"
        className="stroke-chart-observed"
        strokeWidth={3}
        vectorEffect="non-scaling-stroke"
        strokeLinejoin="round"
      />
    </svg>
  );
}

export type ChartForecast = {
  readonly points: readonly PricePoint[];
  /** Highlighted horizon target, if any. */
  readonly focusDate?: string;
};

export function PriceChart({
  title,
  observed,
  forecast,
  height = 260,
  className,
}: {
  /** Accessible name; a text summary is added for screen readers. */
  readonly title: string;
  readonly observed: readonly PricePoint[];
  readonly forecast?: ChartForecast;
  readonly height?: number;
  readonly className?: string;
}) {
  const first = observed[0];
  const last = observed.at(-1);
  if (first === undefined || last === undefined) {
    return <p className="text-base text-text-secondary">Riwayat harga belum tersedia.</p>;
  }
  const box: Box = { height, left: 56, right: 16, top: 16, bottom: 32 };
  const all = [...observed, ...(forecast?.points ?? [])];
  const { x, y, y0, y1 } = scale(all, box);
  const ticksY = [y0 + (y1 - y0) * 0.15, (y0 + y1) / 2, y1 - (y1 - y0) * 0.15];
  const end = all.at(-1) ?? last;
  const ticksX = [
    first.date,
    observed[Math.floor(observed.length / 2)]?.date ?? first.date,
    last.date,
    ...(forecast === undefined ? [] : [end.date]),
  ];
  const prices = observed.map((point) => point.price);
  const summary = `${title}. Dari ${formatRupiah(first.price)} pada ${formatDayMonth(first.date)} sampai ${formatRupiah(last.price)} pada ${formatDayMonth(last.date)}; terendah ${formatRupiah(Math.min(...prices))}, tertinggi ${formatRupiah(Math.max(...prices))}.`;
  const fc = forecast === undefined ? [] : [last, ...forecast.points];
  const focus = forecast?.points.find((point) => point.date === forecast.focusDate);
  return (
    <figure className={cn('flex flex-col gap-3', className)}>
      <svg
        viewBox={`0 0 ${String(W)} ${String(height)}`}
        role="img"
        aria-label={summary}
        className="h-auto w-full"
      >
        {ticksY.map((tick) => (
          <g key={tick}>
            <line
              x1={box.left}
              x2={W - box.right}
              y1={y(tick)}
              y2={y(tick)}
              className="stroke-chart-grid"
              strokeWidth={1}
            />
            <text
              x={box.left - 8}
              y={y(tick) + 4}
              textAnchor="end"
              className="fill-text-muted text-xs"
            >
              {thousands(tick)}
            </text>
          </g>
        ))}
        {ticksX.map((date, i) => (
          <text
            key={`${date}-${String(i)}`}
            x={x(date)}
            y={height - 8}
            textAnchor={i === 0 ? 'start' : i === ticksX.length - 1 ? 'end' : 'middle'}
            className="fill-text-muted text-xs"
          >
            {formatDayMonth(date)}
          </text>
        ))}
        {forecast === undefined ? null : (
          <line
            x1={x(last.date)}
            x2={x(last.date)}
            y1={box.top}
            y2={height - box.bottom}
            className="stroke-chart-origin"
            strokeWidth={1.5}
            strokeDasharray="4 4"
          />
        )}
        <path
          d={path(observed, x, y)}
          fill="none"
          className="stroke-chart-observed"
          strokeWidth={2.5}
          strokeLinejoin="round"
          strokeLinecap="round"
        />
        {fc.length > 1 ? (
          <path
            d={path(fc, x, y)}
            fill="none"
            className="stroke-chart-forecast"
            strokeWidth={2.5}
            strokeDasharray="7 6"
            strokeLinecap="round"
          />
        ) : null}
        {forecast?.points.map((point) => (
          <circle
            key={point.date}
            cx={x(point.date)}
            cy={y(point.price)}
            r={point === focus ? 6 : 4}
            className="fill-bg-surface stroke-chart-forecast"
            strokeWidth={2.5}
          />
        ))}
        <circle cx={x(last.date)} cy={y(last.price)} r={4.5} className="fill-chart-observed" />
      </svg>
      <figcaption className="flex flex-wrap gap-x-5 gap-y-2 text-sm text-text-secondary">
        <span className="flex items-center gap-2">
          <span aria-hidden className="h-0.5 w-6 rounded-full bg-chart-observed" />
          Harga aktual
        </span>
        {forecast === undefined ? null : (
          <>
            <span className="flex items-center gap-2">
              <span aria-hidden className="w-6 border-t-2 border-dashed border-chart-forecast" />
              Prediksi (estimasi)
            </span>
            <span className="flex items-center gap-2">
              <span aria-hidden className="h-4 w-0 border-l-2 border-dashed border-chart-origin" />
              Hari dasar
            </span>
          </>
        )}
      </figcaption>
    </figure>
  );
}
