import type { PricePoint } from '@kawan-pasar/contracts';
import type { ReactNode } from 'react';
import { UNKNOWN, changeDirection, formatChange, formatDateWib, formatRupiah } from '@/lib/format';
import './charts.css';
import { ChartTooltip } from './ChartTooltip';
import type { TooltipPoint } from './ChartTooltip';
import {
  RANGE_KEYS,
  RANGE_LABEL,
  VIEW,
  compactRupiah,
  dateTicks,
  linearScale,
  pathFrom,
  pct,
  priceTicks,
  rangeSlices,
  timeScale,
} from './scale';
import type { RangeKey } from './scale';
import { Switch } from './Switch';

/** One sentence describing a range, for everyone (also the chart's text alternative). */
function summary(points: readonly PricePoint[], range: RangeKey): string {
  const first = points[0];
  const last = points.at(-1);
  if (first === undefined || last === undefined || points.length < 2) return 'Data belum cukup';
  const change = last.priceIdr / first.priceIdr - 1;
  const dir = changeDirection(change);
  const verb =
    dir === 'flat'
      ? 'stabil'
      : `${dir === 'up' ? 'naik' : 'turun'} ${formatChange(Math.abs(change)).replace('+', '')}`;
  return `Harga ${verb} dalam ${RANGE_LABEL[range].long}, dari ${formatRupiah(first.priceIdr)} (${formatDateWib(first.observedOn, 'short')}) ke ${formatRupiah(last.priceIdr)} (${formatDateWib(last.observedOn, 'short')}).`;
}

function Panel({ points, range }: { points: readonly PricePoint[]; range: RangeKey }): ReactNode {
  const text = summary(points, range);
  const first = points[0];
  const last = points.at(-1);
  if (first === undefined || last === undefined || points.length < 2) {
    return (
      <div data-range={range}>
        <p className="flex h-[220px] items-center justify-center rounded-md bg-surface-2 text-body-small-13 text-muted-text">
          {text}
        </p>
      </div>
    );
  }
  const prices = points.map((p) => p.priceIdr);
  const y = linearScale(
    [Math.min(...prices), Math.max(...prices)],
    [VIEW.height - VIEW.padBottom, VIEW.padTop],
  );
  const x = timeScale([first.observedOn, last.observedOn], [0, VIEW.width]);
  const d = pathFrom(points, x, y.scale);
  const yTicks = priceTicks(y.domain);
  const tooltip: TooltipPoint[] = points.map((p) => [
    pct(x(p.observedOn), VIEW.width),
    pct(y.scale(p.priceIdr), VIEW.height),
    formatDateWib(p.observedOn, 'short'),
    formatRupiah(p.priceIdr),
  ]);
  return (
    <div data-range={range}>
      <p className="mb-3 text-body-small-13 text-ink-2">{text}</p>
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
            <path
              d={d}
              fill="none"
              className="stroke-ink"
              strokeWidth={2.25}
              strokeLinejoin="round"
              strokeLinecap="round"
              vectorEffect="non-scaling-stroke"
            />
          </svg>
          <ChartTooltip points={tooltip} label={`Telusuri harga, ${RANGE_LABEL[range].long}`} />
        </div>
      </div>
      <div
        aria-hidden="true"
        className="ml-[3.25rem] flex justify-between pt-2 text-[11px] text-muted-text"
      >
        {dateTicks(first.observedOn, last.observedOn).map((t) => (
          <span key={t}>{formatDateWib(t, 'short').replace(/^\w+, /, '')}</span>
        ))}
      </div>
    </div>
  );
}

/** Accessible table of the data behind a chart (works without JavaScript). */
export function ChartDataTable({
  caption,
  rows,
}: {
  caption: string;
  rows: readonly { date: string; value: string }[];
}): ReactNode {
  return (
    <details className="mt-4 text-body-small-13">
      <summary className="inline-flex min-h-11 cursor-pointer items-center font-semibold text-green-900">
        Lihat data dalam tabel
      </summary>
      <div className="mt-2 max-h-72 overflow-auto rounded-md border border-line">
        <table className="w-full text-left">
          <caption className="sr-only">{caption}</caption>
          <thead className="sticky top-0 bg-surface-2">
            <tr>
              <th scope="col" className="px-3 py-2">
                Tanggal
              </th>
              <th scope="col" className="px-3 py-2 text-right">
                Harga
              </th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.date} className="border-t border-line">
                <td className="px-3 py-1.5">{r.date}</td>
                <td className="tabular px-3 py-1.5 text-right font-mono">{r.value}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </details>
  );
}

/**
 * Price history (v0.4 "Riwayat harga"): server-rendered SVG for 30 days, 90 days, 1 year and all
 * data; the range pills only switch which one is visible. Rendered by the page with data it
 * already fetched (no client fetch).
 */
export function PriceChart({
  id,
  title,
  points365,
  pointsAll,
  description,
}: {
  id: string;
  title: string;
  points365: readonly PricePoint[];
  pointsAll: readonly PricePoint[];
  description?: string;
}): ReactNode {
  const slices = rangeSlices(points365, pointsAll);
  const table = slices['90d'].map((p) => ({
    date: formatDateWib(p.observedOn, 'short'),
    value: p.priceIdr > 0 ? formatRupiah(p.priceIdr) : UNKNOWN,
  }));
  return (
    <figure aria-labelledby={`${id}-title`} className="min-w-0">
      <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <h2 id={`${id}-title`} className="text-heading-card-16 sm:text-heading-title-20">
            {title}
          </h2>
          {description === undefined ? null : (
            <p className="text-body-small-13 text-muted-text">{description}</p>
          )}
        </div>
        <Switch
          targetId={id}
          name="range"
          label="Rentang waktu grafik"
          defaultValue="90d"
          options={RANGE_KEYS.map((k) => ({
            value: k,
            short: RANGE_LABEL[k].short,
            long: RANGE_LABEL[k].long,
          }))}
        />
      </div>
      <div id={id} data-active-range="90d">
        {RANGE_KEYS.map((k) => (
          <Panel key={k} points={slices[k]} range={k} />
        ))}
      </div>
      <ChartDataTable caption={`${title}, 90 hari terakhir`} rows={table} />
    </figure>
  );
}
