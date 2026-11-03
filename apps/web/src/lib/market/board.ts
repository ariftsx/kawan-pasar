// Price-board maths shared by Beranda, Harga, Detail, and Mode Analis. Pure functions: unknown
// stays `null` (never 0) and nothing here claims why a price moved.
import { listCommodities, type Commodity } from '@kawan-pasar/catalog';

import { DEMO_AS_OF, demoSeries, type PricePoint } from './demo-series';

export type BoardRow = {
  readonly commodity: Commodity;
  readonly price: number | null;
  readonly change7: number | null;
  readonly change30: number | null;
  readonly delta7: number | null;
  readonly history: readonly PricePoint[];
};

export type PriceBoard =
  | { readonly status: 'demo'; readonly asOf: string; readonly rows: readonly BoardRow[] }
  | { readonly status: 'unavailable'; readonly rows: readonly BoardRow[] };

/** Relative change over `days`, or `null` when the history is too short. */
export function changeOver(history: readonly PricePoint[], days: number): number | null {
  const last = history.at(-1);
  const before = history.at(-1 - days);
  if (last === undefined || before === undefined) return null;
  return (last.price - before.price) / before.price;
}

/** Rupiah difference over `days`, or `null`. */
export function deltaOver(history: readonly PricePoint[], days: number): number | null {
  const last = history.at(-1);
  const before = history.at(-1 - days);
  return last === undefined || before === undefined ? null : last.price - before.price;
}

export function lastDays(history: readonly PricePoint[], days: number): readonly PricePoint[] {
  return history.slice(Math.max(0, history.length - days));
}

function row(commodity: Commodity, history: readonly PricePoint[]): BoardRow {
  return {
    commodity,
    price: history.at(-1)?.price ?? null,
    change7: changeOver(history, 7),
    change30: changeOver(history, 30),
    delta7: deltaOver(history, 7),
    history,
  };
}

/**
 * Demo mode draws the labelled sample history. Live mode waits for the daily ingest (F2), so
 * every price is unknown and the UI says "harga belum tersedia" instead of inventing one.
 */
export function priceBoard(mode: 'demo' | 'live'): PriceBoard {
  const commodities = listCommodities();
  if (mode === 'live') {
    return { status: 'unavailable', rows: commodities.map((item) => row(item, [])) };
  }
  return {
    status: 'demo',
    asOf: DEMO_AS_OF,
    rows: commodities.map((item) => row(item, demoSeries(item.slug))),
  };
}

/** Rows ordered by the largest absolute 7-day move; unknown changes go last. */
export function byLargestMove(rows: readonly BoardRow[]): readonly BoardRow[] {
  return [...rows].sort((a, b) => Math.abs(b.change7 ?? -1) - Math.abs(a.change7 ?? -1));
}

/** The biggest 7-day rise and fall for the Beranda highlights. */
export function highlights(rows: readonly BoardRow[]): {
  readonly up: BoardRow | null;
  readonly down: BoardRow | null;
} {
  const known = rows.filter((item) => item.change7 !== null);
  const up = known.reduce<BoardRow | null>(
    (best, item) => ((item.change7 ?? 0) > (best?.change7 ?? 0) ? item : best),
    null,
  );
  const down = known.reduce<BoardRow | null>(
    (best, item) => ((item.change7 ?? 0) < (best?.change7 ?? 0) ? item : best),
    null,
  );
  return { up, down };
}

/** CSV for Mode Analis: one row per commodity and day, demo rows marked as such. */
export function boardCsv(board: PriceBoard): string {
  const header = 'tanggal,komoditas,pasar,harga_idr,sumber';
  const source = board.status === 'demo' ? 'DATA DEMO' : 'PIHPS';
  const lines = board.rows.flatMap((item) =>
    item.history.map(
      (point) => `${point.date},${item.commodity.slug},PIKJ,${String(point.price)},${source}`,
    ),
  );
  return [header, ...lines].join('\n') + '\n';
}
