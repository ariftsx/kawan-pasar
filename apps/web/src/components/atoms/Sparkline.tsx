import type { Direction, PricePoint } from '@kawan-pasar/contracts';
import type { ReactNode } from 'react';
import { cx } from '@/lib/cx';

const STROKE: Record<Direction, string> = {
  up: 'stroke-chili-600',
  down: 'stroke-green-600',
  flat: 'stroke-muted',
};

/**
 * Tiny trend line rendered on the server (no chart library). Decorative: the numbers it
 * summarises are always shown next to it. With fewer than two points it says so instead of
 * drawing a misleading line.
 */
export function Sparkline({
  points,
  direction,
  width = 196,
  height = 30,
  className,
}: {
  points: readonly PricePoint[];
  direction: Direction | null;
  width?: number;
  height?: number;
  className?: string;
}): ReactNode {
  if (points.length < 2) {
    return (
      <span className={cx('flex items-center gap-2', className)} style={{ minHeight: height }}>
        <svg width="40" height="2" aria-hidden="true" className="shrink-0">
          <line
            x1="0"
            y1="1"
            x2="40"
            y2="1"
            className="stroke-line"
            strokeWidth="2"
            strokeDasharray="4 4"
          />
        </svg>
        <span className="text-[11px] text-muted-text">Data belum cukup</span>
      </span>
    );
  }
  const prices = points.map((p) => p.priceIdr);
  const min = Math.min(...prices);
  const max = Math.max(...prices);
  const span = max - min;
  const pad = 2;
  const step = (width - pad * 2) / (points.length - 1);
  const d = prices
    .map((v, i) => {
      const x = pad + i * step;
      const y = span === 0 ? height / 2 : pad + (1 - (v - min) / span) * (height - pad * 2);
      return `${i === 0 ? 'M' : 'L'}${x.toFixed(1)} ${y.toFixed(1)}`;
    })
    .join(' ');
  return (
    <svg
      viewBox={`0 0 ${String(width)} ${String(height)}`}
      preserveAspectRatio="none"
      aria-hidden="true"
      focusable="false"
      className={cx('block w-full overflow-visible', className)}
      style={{ height }}
    >
      <path
        d={d}
        fill="none"
        className={STROKE[direction ?? 'flat']}
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        vectorEffect="non-scaling-stroke"
      />
    </svg>
  );
}
