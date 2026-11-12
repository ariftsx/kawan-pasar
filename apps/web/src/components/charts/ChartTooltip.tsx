'use client';

import { useState, useSyncExternalStore } from 'react';
import type { KeyboardEvent, PointerEvent, ReactNode } from 'react';

/** One hoverable point: x/y in % of the plot box, plus the text to show. */
export type TooltipPoint = readonly [x: number, y: number, date: string, value: string];

const noSubscription = (): (() => void) => () => undefined;

/**
 * Pointer and keyboard read-out over a server-rendered SVG. Positions are precomputed on the
 * server; this only finds the nearest point. Rendered after hydration only, so there is no dead
 * control without JavaScript (the chart's text summary and table cover that case). Keyboard:
 * arrows move one point, Home/End jump to the first/latest point.
 */
export function ChartTooltip({
  points,
  label,
}: {
  points: readonly TooltipPoint[];
  label: string;
}): ReactNode {
  const hydrated = useSyncExternalStore(
    noSubscription,
    () => true,
    () => false,
  );
  // `null` = nothing highlighted; the slider value is then the latest point.
  const [index, setIndex] = useState<number | null>(null);
  if (!hydrated || points.length === 0) return null;

  const last = points.length - 1;
  const current = index ?? last;
  const p = points[current];

  const nearest = (xPercent: number): number => {
    let best = 0;
    for (let i = 1; i < points.length; i += 1) {
      const a = points[i];
      const b = points[best];
      if (
        a !== undefined &&
        b !== undefined &&
        Math.abs(a[0] - xPercent) < Math.abs(b[0] - xPercent)
      ) {
        best = i;
      }
    }
    return best;
  };
  const onPointer = (e: PointerEvent<HTMLDivElement>): void => {
    const box = e.currentTarget.getBoundingClientRect();
    setIndex(nearest(((e.clientX - box.left) / box.width) * 100));
  };
  const onKey = (e: KeyboardEvent<HTMLDivElement>): void => {
    const next =
      e.key === 'ArrowLeft'
        ? current - 1
        : e.key === 'ArrowRight'
          ? current + 1
          : e.key === 'Home'
            ? 0
            : e.key === 'End'
              ? last
              : null;
    if (next === null) return;
    e.preventDefault();
    setIndex(Math.min(last, Math.max(0, next)));
  };

  return (
    <div
      role="slider"
      tabIndex={0}
      aria-label={label}
      aria-valuemin={0}
      aria-valuemax={last}
      aria-valuenow={current}
      aria-valuetext={p === undefined ? undefined : `${p[2]}: ${p[3]}`}
      className="absolute inset-0 cursor-crosshair touch-pan-y rounded-md"
      onPointerMove={onPointer}
      onPointerDown={onPointer}
      onPointerLeave={() => {
        setIndex(null);
      }}
      onFocus={() => {
        setIndex(last);
      }}
      onKeyDown={onKey}
      onBlur={() => {
        setIndex(null);
      }}
    >
      {index === null || p === undefined ? null : (
        <>
          <span
            aria-hidden="true"
            className="absolute inset-y-0 w-px bg-ink/40"
            style={{ left: `${String(p[0])}%` }}
          />
          <span
            aria-hidden="true"
            className="absolute size-2.5 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-surface bg-ink"
            style={{ left: `${String(p[0])}%`, top: `${String(p[1])}%` }}
          />
          <span
            aria-hidden="true"
            className="tabular pointer-events-none absolute top-0 z-10 -translate-x-1/2 rounded-md bg-ink px-2 py-1 text-[11px] leading-tight whitespace-nowrap text-surface"
            style={{ left: `${String(Math.min(85, Math.max(15, p[0])))}%` }}
          >
            {p[2]}
            <br />
            <strong className="font-mono">{p[3]}</strong>
          </span>
        </>
      )}
    </div>
  );
}
