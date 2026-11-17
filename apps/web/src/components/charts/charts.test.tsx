import type { ForecastHorizon, PricePoint } from '@kawan-pasar/contracts';
import { render, screen } from '@testing-library/react';
import { renderToString } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { ChartTooltip } from './ChartTooltip';
import { ForecastChart } from './ForecastChart';
import { PriceChart } from './PriceChart';
import {
  compactRupiah,
  dateTicks,
  linearScale,
  pathFrom,
  pct,
  priceTicks,
  rangeSlices,
  timeScale,
} from './scale';

const days = (from: string, n: number, price: (i: number) => number): PricePoint[] =>
  Array.from({ length: n }, (_, i) => ({
    observedOn: new Date(Date.parse(`${from}T00:00:00Z`) + i * 86_400_000)
      .toISOString()
      .slice(0, 10),
    priceIdr: price(i),
  }));

describe('pct', () => {
  it('rounds to 0.1 % of the plot box (under a pixel) to keep the client payload small', () => {
    expect(pct(474.35821401338643, 640)).toBe(74.1);
    expect(pct(0, 640)).toBe(0);
    expect(pct(640, 640)).toBe(100);
    expect(String(pct(1, 3))).toBe('33.3');
  });
});

describe('scale', () => {
  it('maps dates and prices into the drawing box', () => {
    const x = timeScale(['2026-09-01', '2026-09-11'], [0, 100]);
    expect(x('2026-09-06')).toBe(50);
    const y = linearScale([100, 200], [100, 0]);
    expect(y.scale(150)).toBeGreaterThan(0);
    expect(y.scale(150)).toBeLessThan(100);
  });

  it('gives a flat series a real range instead of dividing by zero', () => {
    const y = linearScale([13_650, 13_650], [100, 0]);
    expect(Number.isFinite(y.scale(13_650))).toBe(true);
    expect(y.scale(13_650)).toBeCloseTo(50, 0);
    expect(y.domain[0]).toBeLessThan(13_650);
  });

  it('never writes NaN into a path, and needs two points for a line', () => {
    const x = timeScale(['2026-09-01', '2026-09-01'], [0, 100]);
    const y = linearScale([1, 1], [100, 0]);
    expect(pathFrom([{ observedOn: '2026-09-01', priceIdr: 1 }], x, y.scale)).toBe('');
    expect(
      pathFrom(
        days('2026-09-01', 3, () => 5),
        x,
        y.scale,
      ),
    ).not.toContain('NaN');
  });

  it('labels prices compactly', () => {
    expect(compactRupiah(52_400)).toBe('52 rb');
    expect(compactRupiah(13_650)).toBe('13,7 rb');
    expect(compactRupiah(1_250_000)).toBe('1,25 jt');
    expect(priceTicks([48_000, 63_000]).length).toBeGreaterThanOrEqual(2);
  });

  it('slices ranges relative to the latest observation, keeping gaps as gaps', () => {
    const series = [...days('2025-10-01', 5, () => 10), ...days('2026-09-01', 30, (i) => 20 + i)];
    const s = rangeSlices(series, series);
    expect(s['30d'][0]?.observedOn).toBe('2026-09-01');
    expect(s['365d'].length).toBe(series.length);
    expect(s['90d'].length).toBe(30);
  });
});

describe('PriceChart', () => {
  const pts = days('2025-10-01', 365, (i) => 40_000 + i * 10);

  it('titles the chart as a section heading (level 2: it sits right under the page title)', () => {
    render(<PriceChart id="c0" title="Riwayat harga" points365={pts} pointsAll={pts} />);
    expect(screen.getByRole('heading', { level: 2, name: 'Riwayat harga' })).toBeDefined();
  });

  it('renders all ranges with 90 days active by default (works without JavaScript)', () => {
    const { container } = render(
      <PriceChart id="c1" title="Riwayat harga" points365={pts} pointsAll={pts} />,
    );
    const root = container.querySelector('[data-active-range]');
    expect(root?.getAttribute('data-active-range')).toBe('90d');
    expect(container.querySelectorAll('[data-range]').length).toBe(4);
    expect(container.innerHTML).not.toContain('NaN');
    expect(screen.getByText(/naik .* dalam 90 hari/)).toBeTruthy();
  });

  it('says when a range has too little data', () => {
    render(
      <PriceChart id="c2" title="Riwayat" points365={pts.slice(-1)} pointsAll={pts.slice(-1)} />,
    );
    expect(screen.getAllByText('Data belum cukup').length).toBeGreaterThan(0);
  });

  it('offers the data as a table', () => {
    render(<PriceChart id="c3" title="Riwayat" points365={pts} pointsAll={pts} />);
    expect(screen.getByText('Lihat data dalam tabel')).toBeTruthy();
  });
});

const horizon = (d: number, q50: number | null): ForecastHorizon => ({
  horizonDays: d as ForecastHorizon['horizonDays'],
  targetDate: new Date(Date.parse('2026-09-30T00:00:00Z') + d * 86_400_000)
    .toISOString()
    .slice(0, 10),
  q10Change: q50 === null ? null : q50 - 0.1,
  q50Change: q50,
  q90Change: q50 === null ? null : q50 + 0.1,
  q10PriceIdr: q50 === null ? null : 50_000,
  q50PriceIdr: q50 === null ? null : 60_000,
  q90PriceIdr: q50 === null ? null : 70_000,
  evalStatus: q50 === null ? 'not_tested' : 'available',
});

describe('ForecastChart', () => {
  const actual = days('2026-08-01', 61, () => 60_000);
  const horizons = [1, 3, 7, 14, 30, 90, 180, 365].map((d) => horizon(d, d >= 180 ? null : 0.01));

  it('draws actual, median and band, with a short and a long time axis', () => {
    const { container } = render(
      <ForecastChart
        id="f1"
        actual={actual}
        baseDate="2026-09-30"
        basePriceIdr={60_000}
        horizons={horizons}
      />,
    );
    expect(
      container.querySelector('[data-active-horizon]')?.getAttribute('data-active-horizon'),
    ).toBe('7');
    expect(container.querySelectorAll('[data-scale]').length).toBe(2);
    expect(container.querySelector('[data-series="median"]')).not.toBeNull();
    expect(container.querySelector('[data-series="band"]')).not.toBeNull();
    expect(container.innerHTML).not.toContain('NaN');
  });

  it('stops the band at the last horizon with known quantiles', () => {
    const { container } = render(
      <ForecastChart
        id="f2"
        actual={actual}
        baseDate="2026-09-30"
        basePriceIdr={60_000}
        horizons={horizons}
      />,
    );
    // 180 and 365 are unknown: no marker for them.
    expect(container.querySelector('[data-h="180"]')).toBeNull();
    expect(container.querySelector('[data-h="90"]')).not.toBeNull();
  });
});

describe('ChartTooltip', () => {
  const points = [
    [0, 50, 'Sen, 28 Sep 2026', 'Rp 50.000'],
    [100, 40, 'Rab, 30 Sep 2026', 'Rp 52.400'],
  ] as const;

  it('is not in the server HTML, so there is no dead control without JavaScript', () => {
    expect(renderToString(<ChartTooltip points={points} label="Telusuri" />)).toBe('');
  });

  it('always announces a date and price, starting at the latest point', () => {
    render(<ChartTooltip points={points} label="Telusuri" />);
    const slider = screen.getByRole('slider', { name: 'Telusuri' });
    expect(slider.getAttribute('aria-valuenow')).toBe('1');
    expect(slider.getAttribute('aria-valuetext')).toBe('Rab, 30 Sep 2026: Rp 52.400');
  });
});

describe('ForecastChart text alternative', () => {
  it('summarises the active horizon and lists every horizon in a table', () => {
    const actual = days('2026-08-01', 61, () => 60_000);
    const horizons = [1, 3, 7, 14, 30, 90, 180, 365].map((d) => horizon(d, d >= 180 ? null : 0.01));
    render(
      <ForecastChart
        id="f3"
        actual={actual}
        baseDate="2026-09-30"
        basePriceIdr={60_000}
        horizons={horizons}
      />,
    );
    expect(screen.getByText(/Perkiraan median 7 hari/)).toBeTruthy();
    const table = screen.getByRole('table', { name: /Prediksi per horizon/ });
    expect(table.querySelectorAll('tbody tr')).toHaveLength(8);
  });
});

describe('dateTicks', () => {
  it('never repeats a date for short spans', () => {
    const t = dateTicks('2026-09-29', '2026-09-30');
    expect(new Set(t).size).toBe(t.length);
  });
});
