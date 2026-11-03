import { describe, expect, it } from 'vitest';

import {
  boardCsv,
  byLargestMove,
  changeOver,
  deltaOver,
  highlights,
  lastDays,
  priceBoard,
} from './board';
import { DEMO_AS_OF, demoSeries, shiftDate } from './demo-series';

describe('demo series', () => {
  it('is deterministic and ends at the catalog demo price on the demo date', () => {
    const first = demoSeries('cabai-merah-keriting');
    expect(demoSeries('cabai-merah-keriting')).toEqual(first);
    expect(first).toHaveLength(365);
    expect(first.at(-1)).toEqual({ date: DEMO_AS_OF, price: 52_400 });
    expect(first[0]?.date).toBe(shiftDate(DEMO_AS_OF, -364));
  });

  it('keeps rice mostly unchanged and every price positive and quoted', () => {
    const rice = demoSeries('beras-medium-1');
    const changes = rice.slice(1).filter((point, i) => point.price !== rice[i]?.price);
    expect(changes.length).toBeLessThan(rice.length / 2);
    for (const point of demoSeries('cabai-rawit-merah')) {
      expect(point.price).toBeGreaterThan(0);
      expect(point.price % 50).toBe(0);
    }
  });

  it('rejects an unknown commodity', () => {
    expect(() => demoSeries('beras' as never)).toThrow('Komoditas tidak dikenal');
  });

  it('shifts dates across month and year ends', () => {
    expect(shiftDate('2026-12-31', 1)).toBe('2027-01-01');
    expect(shiftDate('2026-03-01', -1)).toBe('2026-02-28');
  });
});

describe('price board', () => {
  const series = [
    { date: '2026-10-01', price: 100 },
    { date: '2026-10-02', price: 110 },
  ];

  it('computes changes and keeps unknown as null', () => {
    expect(changeOver(series, 1)).toBeCloseTo(0.1);
    expect(deltaOver(series, 1)).toBe(10);
    expect(changeOver(series, 7)).toBeNull();
    expect(deltaOver([], 1)).toBeNull();
    expect(lastDays(series, 1)).toEqual([series[1]]);
  });

  it('serves the five commodities with labelled demo prices', () => {
    const board = priceBoard('demo');
    expect(board.status).toBe('demo');
    expect(board.rows).toHaveLength(5);
    expect(board.rows[0]?.price).toBe(52_400);
    expect(boardCsv(board)).toContain('2026-10-18,cabai-merah-keriting,PIKJ,52400,DATA DEMO');
  });

  it('never invents a price in live mode before the ingest exists', () => {
    const board = priceBoard('live');
    expect(board.status).toBe('unavailable');
    expect(board.rows.every((item) => item.price === null && item.change7 === null)).toBe(true);
    expect(boardCsv(board).trim()).toBe('tanggal,komoditas,pasar,harga_idr,sumber');
    expect(highlights(board.rows)).toEqual({ up: null, down: null });
  });

  it('orders by the largest move and finds the extremes', () => {
    const rows = priceBoard('demo').rows;
    const ordered = byLargestMove(rows);
    expect(Math.abs(ordered[0]?.change7 ?? 0)).toBeGreaterThanOrEqual(
      Math.abs(ordered[1]?.change7 ?? 0),
    );
    const { up, down } = highlights(rows);
    for (const item of rows) {
      expect(item.change7 ?? 0).toBeLessThanOrEqual(up?.change7 ?? 0);
    }
    expect(down === null || (down.change7 ?? 0) < 0).toBe(true);
  });
});
