'use client';

import { useMemo, useState, useSyncExternalStore } from 'react';
import type { ReactNode } from 'react';
import type { AnalystMetric, AnalystRange, CompactSeries } from '@/lib/analyst/series';
import { METRICS, RANGES, decodeSeries, transform, withinRange } from '@/lib/analyst/series';
import { cx } from '@/lib/cx';

export interface ExplorerSeries {
  code: string;
  name: string;
  /** A color token name (resolved from CSS for the PNG). */
  color: 'chili-600' | 'terong-600' | 'green-600' | 'shallot-500' | 'kunyit-500';
  /** Compact on the wire (Lighthouse TBT); decoded once in the browser. */
  points: CompactSeries;
}

const W = 1200;
const H = 320;
const PAD = { top: 16, right: 16, bottom: 28, left: 72 };
const noSubscription = (): (() => void) => () => undefined;
const useHydrated = (): boolean =>
  useSyncExternalStore(
    noSubscription,
    () => true,
    () => false,
  );

const id = new Intl.NumberFormat('id-ID', { maximumFractionDigits: 1 });
const rupiah = new Intl.NumberFormat('id-ID', { maximumFractionDigits: 0 });
const formatValue = (v: number, metric: AnalystMetric): string =>
  metric === 'harga'
    ? `Rp ${rupiah.format(v)}`
    : metric === 'perubahan'
      ? `${id.format(v)}%`
      : id.format(v);
const shortDay = (d: string): string =>
  new Date(`${d}T12:00:00Z`).toLocaleDateString('id-ID', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });

/** Comparison chart of Mode Analis (prototype d_analis). Plain SVG, no chart library. */
export function AnalystExplorer({
  series,
  latest,
}: {
  series: ExplorerSeries[];
  latest: string;
}): ReactNode {
  const hydrated = useHydrated();
  const [selected, setSelected] = useState<string[]>(series.map((s) => s.code));
  const [range, setRange] = useState<AnalystRange>('1t');
  const [metric, setMetric] = useState<AnalystMetric>('indeks');
  const [pngFailed, setPngFailed] = useState(false);

  const decoded = useMemo(
    () => series.map((s) => ({ ...s, days: decodeSeries(s.points) })),
    [series],
  );
  const lines = useMemo(
    () =>
      decoded
        .filter((s) => selected.includes(s.code))
        .map((s) => ({ ...s, values: transform(withinRange(s.days, range, latest), metric) })),
    [decoded, selected, range, metric, latest],
  );
  const all = lines.flatMap((l) => l.values);
  const days = all.map((v) => v.day).sort();
  const first = days[0] ?? latest;
  const t0 = Date.parse(`${first}T00:00:00Z`);
  const t1 = Date.parse(`${latest}T00:00:00Z`);
  const min = Math.min(...all.map((v) => v.value));
  const max = Math.max(...all.map((v) => v.value));
  const span = max - min || 1;
  const x = (d: string): number =>
    PAD.left +
    ((Date.parse(`${d}T00:00:00Z`) - t0) / Math.max(t1 - t0, 1)) * (W - PAD.left - PAD.right);
  const y = (v: number): number => PAD.top + (1 - (v - min) / span) * (H - PAD.top - PAD.bottom);
  const ticks = [0, 0.25, 0.5, 0.75, 1].map((f) => min + f * span);

  function downloadPng(): void {
    const svg = document.getElementById('analis-chart');
    if (svg === null) return;
    const css = getComputedStyle(document.documentElement);
    // Standalone image: resolve the CSS color variables the page uses.
    const markup = new XMLSerializer()
      .serializeToString(svg)
      .replace(
        /var\((--[a-z0-9-]+)\)/g,
        (_m, name: string) => css.getPropertyValue(name).trim() || '#000',
      );
    const img = new Image();
    setPngFailed(false);
    img.onerror = () => {
      setPngFailed(true);
    };
    img.onload = () => {
      // Title, legend and source around the chart: the image must make sense on its own.
      const S = 2;
      const TOP = 56;
      const BOTTOM = 64;
      const canvas = document.createElement('canvas');
      canvas.width = W * S;
      canvas.height = (H + TOP + BOTTOM) * S;
      const ctx = canvas.getContext('2d');
      if (ctx === null) return;
      ctx.scale(S, S);
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(0, 0, W, H + TOP + BOTTOM);
      const ink = css.getPropertyValue('--color-ink').trim() || '#111';
      const muted = css.getPropertyValue('--color-ink-2').trim() || '#555';
      ctx.fillStyle = ink;
      ctx.font = '600 20px system-ui, sans-serif';
      const metricLabel = METRICS.find((m) => m.id === metric)?.label ?? '';
      ctx.fillText(`Kawan Pasar · Mode Analis: ${metricLabel}`, PAD.left, 32);
      ctx.drawImage(img, 0, TOP, W, H);
      ctx.font = '14px system-ui, sans-serif';
      let lx = PAD.left;
      for (const l of lines) {
        ctx.fillStyle = css.getPropertyValue(`--color-${l.color}`).trim() || ink;
        ctx.fillRect(lx, H + TOP + 14, 18, 4);
        ctx.fillStyle = ink;
        ctx.fillText(l.name, lx + 24, H + TOP + 21);
        lx += 24 + ctx.measureText(l.name).width + 24;
      }
      ctx.fillStyle = muted;
      ctx.font = '12px system-ui, sans-serif';
      ctx.fillText(
        `Sumber: Kawan Pasar, data harga Pasar Kramat Jati, ${shortDay(first)} sampai ${shortDay(latest)}.`,
        PAD.left,
        H + TOP + 48,
      );
      canvas.toBlob((blob) => {
        if (blob === null) return;
        const a = document.createElement('a');
        a.href = URL.createObjectURL(blob);
        a.download = `kawan-pasar-analis-${range}-${metric}.png`;
        a.click();
        setTimeout(() => {
          URL.revokeObjectURL(a.href);
        }, 1_000);
      }, 'image/png');
    };
    img.src = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(markup)}`;
  }

  return (
    <div className="flex flex-col gap-5">
      {/* Rendered before hydration too (space kept, no layout shift), but hidden and inert. */}
      <div
        className={cx('flex flex-wrap items-end gap-4', !hydrated && 'invisible')}
        role="group"
        aria-label="Pilihan grafik"
        inert={!hydrated}
      >
        <fieldset className="flex flex-col gap-1.5">
          <legend className="text-overline-11 text-muted-text uppercase">Komoditas</legend>
          <div className="flex flex-wrap gap-2">
            {series.map((s) => {
              const on = selected.includes(s.code);
              return (
                <button
                  key={s.code}
                  type="button"
                  aria-pressed={on}
                  onClick={() => {
                    setSelected((cur) =>
                      on
                        ? cur.length > 1
                          ? cur.filter((c) => c !== s.code)
                          : cur
                        : [...cur, s.code],
                    );
                  }}
                  className={cx(
                    'inline-flex min-h-11 items-center gap-2 rounded-full border px-4 text-[14px] font-semibold',
                    on ? 'border-ink bg-surface' : 'border-line bg-surface-2 text-ink-2',
                  )}
                >
                  <span
                    aria-hidden="true"
                    className="size-2.5 rounded-full"
                    style={{ background: `var(--color-${s.color})` }}
                  />
                  {s.name}
                </button>
              );
            })}
          </div>
        </fieldset>
        <fieldset className="flex flex-col gap-1.5">
          <legend className="text-overline-11 text-muted-text uppercase">Rentang</legend>
          <div className="flex gap-1 rounded-full border border-line bg-surface p-1">
            {RANGES.map((r) => (
              <button
                key={r.id}
                type="button"
                aria-pressed={range === r.id}
                onClick={() => {
                  setRange(r.id);
                }}
                className={cx(
                  'min-h-9 rounded-full px-3 text-[13px] font-semibold',
                  range === r.id ? 'bg-green-900 text-surface' : 'text-ink-2',
                )}
              >
                {r.label}
              </button>
            ))}
          </div>
        </fieldset>
        <label className="flex flex-col gap-1.5">
          <span className="text-overline-11 text-muted-text uppercase">Metrik</span>
          <select
            value={metric}
            onChange={(e) => {
              setMetric(e.target.value as AnalystMetric);
            }}
            className="min-h-11 rounded-md border border-line bg-surface px-3 text-[14px]"
          >
            {METRICS.map((m) => (
              <option key={m.id} value={m.id}>
                {m.label}
              </option>
            ))}
          </select>
        </label>
        <button
          type="button"
          onClick={downloadPng}
          className="ml-auto inline-flex min-h-11 items-center rounded-full bg-green-900 px-5 text-[14px] font-semibold text-surface"
        >
          Unduh grafik PNG
        </button>
        <p role="status" className="basis-full text-body-small-13 text-chili-700 empty:hidden">
          {pngFailed ? 'Grafik belum bisa diunduh di peramban ini. Coba peramban lain.' : ''}
        </p>
      </div>

      <figure className="flex flex-col gap-3">
        <div
          className="overflow-x-auto"
          tabIndex={0}
          role="region"
          aria-label="Grafik perbandingan, geser ke samping di layar sempit"
        >
          <svg
            id="analis-chart"
            xmlns="http://www.w3.org/2000/svg"
            viewBox={`0 0 ${String(W)} ${String(H)}`}
            className="h-auto w-full min-w-[36rem]"
            role="img"
            aria-label={`Grafik ${METRICS.find((m) => m.id === metric)?.label ?? ''}, ${shortDay(first)} sampai ${shortDay(latest)}`}
            fontFamily="system-ui, sans-serif"
            fontSize="13"
          >
            {ticks.map((t) => (
              <g key={t}>
                <line
                  x1={PAD.left}
                  x2={W - PAD.right}
                  y1={y(t)}
                  y2={y(t)}
                  stroke="var(--color-line)"
                />
                <text x={PAD.left - 8} y={y(t) + 4} textAnchor="end" fill="var(--color-ink-2)">
                  {formatValue(t, metric)}
                </text>
              </g>
            ))}
            <text x={PAD.left} y={H - 6} fill="var(--color-ink-2)">
              {shortDay(first)}
            </text>
            <text x={W - PAD.right} y={H - 6} textAnchor="end" fill="var(--color-ink-2)">
              {shortDay(latest)}
            </text>
            {lines.map((l) => (
              <polyline
                key={l.code}
                fill="none"
                stroke={`var(--color-${l.color})`}
                strokeWidth="2.5"
                strokeLinejoin="round"
                points={l.values
                  .map((v) => `${x(v.day).toFixed(1)},${y(v.value).toFixed(1)}`)
                  .join(' ')}
              />
            ))}
          </svg>
        </div>
        <figcaption className="flex flex-wrap gap-4 text-body-small-13">
          {lines.map((l) => {
            const last = l.values.at(-1);
            return (
              <span key={l.code} className="inline-flex items-center gap-2">
                <span
                  aria-hidden="true"
                  className="h-1 w-5 rounded-full"
                  style={{ background: `var(--color-${l.color})` }}
                />
                {l.name}
                {last === undefined ? '' : `: ${formatValue(last.value, metric)}`}
              </span>
            );
          })}
        </figcaption>
      </figure>
    </div>
  );
}
