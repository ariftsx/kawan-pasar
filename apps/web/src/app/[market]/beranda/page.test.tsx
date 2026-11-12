import { render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  ARTICLES,
  forecastFixture,
  historyFixture,
  summaryFixture,
} from '../../../../test/fixtures';

const api = vi.hoisted(() => ({
  priceSummary: vi.fn(),
  forecast: vi.fn(),
  history: vi.fn(),
  articles: vi.fn(),
}));
vi.mock('@/lib/api/endpoints', () => ({ api }));
vi.mock('next/navigation', () => ({
  usePathname: () => '/beranda',
  useRouter: () => ({ refresh: vi.fn(), push: vi.fn() }),
  notFound: () => {
    throw new Error('NEXT_NOT_FOUND');
  },
}));

const { default: Beranda } = await import('./page');

const params = Promise.resolve({ market: 'PIKJ' });

beforeEach(() => {
  api.priceSummary.mockResolvedValue({ ok: true, data: summaryFixture() });
  api.forecast.mockResolvedValue({ ok: true, data: forecastFixture() });
  api.history.mockResolvedValue({ ok: true, data: historyFixture(64) });
  api.articles.mockResolvedValue({ ok: true, data: { items: ARTICLES } });
});

describe('Beranda', () => {
  it('shows highlights, prices and forecasts from the data, with demo labels and versions', async () => {
    render(await Beranda({ params }));
    const page = document.body.textContent;
    expect(screen.getByText('Paling naik minggu ini')).toBeTruthy();
    expect(page).toContain('Tidak ada yang turun minggu ini');
    expect(page).toContain('Bawang merah');
    expect(page).toContain('Data demo');
    expect(page).toContain('demo-empirical-quantile-v1');
    expect(page).toContain('bukan jaminan harga');
    expect(page).not.toMatch(/Rp\s?0\b/);
  });

  it('shows no forecast numbers when the summary carries no artifact', async () => {
    api.priceSummary.mockResolvedValue({
      ok: true,
      data: summaryFixture({
        forecastArtifact: null,
        items: summaryFixture().items.map((i) => ({
          ...i,
          forecast7d: { status: 'unavailable' as const, q50Change: null, direction: null },
        })),
      }),
    });
    api.forecast.mockResolvedValue({
      ok: true,
      data: forecastFixture({ status: 'unavailable', artifact: null, horizons: [] }),
    });
    render(await Beranda({ params }));
    const page = document.body.textContent;
    expect(page).not.toContain('Data demo');
    expect(page).not.toContain('★');
    expect(document.querySelector('[data-series="median"]')).toBeNull();
  });

  it('labels expired forecasts on the highlight card and the page metadata', async () => {
    const expired = summaryFixture();
    api.priceSummary.mockResolvedValue({
      ok: true,
      data: {
        ...expired,
        forecastArtifact:
          expired.forecastArtifact === null ? null : { ...expired.forecastArtifact, ageDays: 10 },
        items: expired.items.map((i) =>
          i.forecast7d.status === 'available'
            ? { ...i, forecast7d: { ...i.forecast7d, status: 'expired' as const } }
            : i,
        ),
      },
    });
    api.forecast.mockResolvedValue({ ok: true, data: forecastFixture({ status: 'expired' }) });
    render(await Beranda({ params }));
    expect(screen.getByText('Prediksi 7 hari · Kedaluwarsa')).toBeTruthy();
    expect(screen.getAllByText('Kedaluwarsa').length).toBeGreaterThanOrEqual(3);
  });

  it('says a hidden forecast is unavailable, not "coming later"', async () => {
    api.forecast.mockResolvedValue({
      ok: true,
      data: forecastFixture({ status: 'hidden' }),
    });
    render(await Beranda({ params }));
    expect(document.body.textContent).not.toContain('tahap pengembangan berikutnya');
  });

  it('fetches exactly four cached resources', async () => {
    render(await Beranda({ params }));
    const calls =
      api.priceSummary.mock.calls.length +
      api.forecast.mock.calls.length +
      api.history.mock.calls.length +
      api.articles.mock.calls.length;
    expect(calls).toBe(4);
  });
});
