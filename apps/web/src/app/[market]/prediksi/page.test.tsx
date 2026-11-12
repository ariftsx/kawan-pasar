import { render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { forecastFixture, historyFixture } from '../../../../test/fixtures';

const api = vi.hoisted(() => ({ forecast: vi.fn(), history: vi.fn() }));
vi.mock('@/lib/api/endpoints', () => ({ api }));
vi.mock('next/navigation', () => ({
  usePathname: () => '/prediksi',
  useRouter: () => ({ refresh: vi.fn(), push: vi.fn() }),
  notFound: () => {
    throw new Error('NEXT_NOT_FOUND');
  },
}));

const { default: Prediksi } = await import('./page');
const { default: PrediksiKomoditas } = await import('./[commodity]/page');

const market = Promise.resolve({ market: 'PIKJ' });

beforeEach(() => {
  api.forecast.mockResolvedValue({ ok: true, data: forecastFixture() });
  api.history.mockResolvedValue({ ok: true, data: historyFixture(64) });
});

const section = (): HTMLElement => {
  const el = document.getElementById('prediksi-panel');
  if (el === null) throw new Error('no forecast panel');
  return el;
};

describe('Prediksi', () => {
  it('starts on the 7-day horizon, with one set of metric cards per horizon', async () => {
    render(await Prediksi({ params: market }));
    expect(section().getAttribute('data-active-horizon')).toBe('7');
    expect(section().querySelectorAll('div[data-horizon-only]').length).toBe(8);
    expect(section().querySelectorAll('tr[data-row]').length).toBe(8);
    expect(document.body.textContent).toContain('Data demo');
    expect(document.body.textContent).toContain('demo-empirical-quantile-v1');
    expect(document.body.textContent).toContain('bukan jaminan harga');
    expect(api.forecast).toHaveBeenCalledWith('PIKJ', 'cabai-merah-keriting');
  });

  it('offers plain links to every forecastable commodity (works without JavaScript)', async () => {
    render(await Prediksi({ params: market }));
    const links = [...document.querySelectorAll('noscript a, [data-picker-fallback] a')].map((a) =>
      a.getAttribute('href'),
    );
    expect(links).toEqual(
      expect.arrayContaining([
        '/prediksi/cabai-merah-keriting',
        '/prediksi/bawang-merah',
        '/prediksi/beras-medium-1',
      ]),
    );
  });

  it('labels an expired forecast', async () => {
    api.forecast.mockResolvedValue({ ok: true, data: forecastFixture({ status: 'expired' }) });
    render(await Prediksi({ params: market }));
    expect(screen.getAllByText('Kedaluwarsa').length).toBeGreaterThan(0);
  });

  it.each(['hidden', 'unavailable'] as const)(
    'shows no forecast number when %s',
    async (status) => {
      api.forecast.mockResolvedValue({ ok: true, data: forecastFixture({ status }) });
      render(await Prediksi({ params: market }));
      expect(document.getElementById('prediksi-panel')).toBeNull();
      expect(document.querySelector('main, body')?.textContent).not.toMatch(/Rp\u00a0\d/);
    },
  );

  it('shows the "coming later" state for a commodity not covered yet', async () => {
    api.forecast.mockResolvedValue({
      ok: true,
      data: forecastFixture({ status: 'pending_coverage', artifact: null, horizons: [] }),
    });
    render(
      await PrediksiKomoditas({
        params: Promise.resolve({ market: 'PIKJ', commodity: 'cabai-rawit-merah' }),
      }),
    );
    expect(screen.getByRole('heading', { name: /belum tersedia/ })).toBeTruthy();
  });
});
