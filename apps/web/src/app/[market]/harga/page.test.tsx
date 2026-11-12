import { render, screen, within } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { forecastFixture, historyFixture, summaryFixture } from '../../../../test/fixtures';

const api = vi.hoisted(() => ({
  priceSummary: vi.fn(),
  forecast: vi.fn(),
  history: vi.fn(),
}));
vi.mock('@/lib/api/endpoints', () => ({ api }));
vi.mock('next/navigation', () => ({
  usePathname: () => '/harga',
  useRouter: () => ({ refresh: vi.fn(), push: vi.fn() }),
  notFound: () => {
    throw new Error('NEXT_NOT_FOUND');
  },
}));

const { default: Harga } = await import('./page');
const { default: Detail } = await import('./[commodity]/page');

beforeEach(() => {
  api.priceSummary.mockResolvedValue({ ok: true, data: summaryFixture() });
  api.forecast.mockResolvedValue({ ok: true, data: forecastFixture() });
  api.history.mockImplementation((_m: string, _c: string, range: string) =>
    Promise.resolve({ ok: true, data: historyFixture(range === 'all' ? 300 : 120) }),
  );
});

describe('Harga', () => {
  it('lists every commodity, with unknown prices as "—" and items ready for filtering', async () => {
    render(await Harga({ params: Promise.resolve({ market: 'PIKJ' }) }));
    const table = screen.getByRole('table', { name: /Harga komoditas/ });
    expect(within(table).getAllByRole('row')).toHaveLength(6);
    expect(within(table).getByText('Cabai rawit hijau').closest('tr')?.textContent).toContain('—');
    expect(document.querySelectorAll('[data-coverage="pending"]').length).toBeGreaterThan(0);
    expect(document.body.textContent).toContain('Bukan harga real-time');
    expect(document.body.textContent).not.toMatch(/Rp\s?0\b/);
  });
});

describe('Detail komoditas', () => {
  const detail = (commodity: string) =>
    Detail({ params: Promise.resolve({ market: 'PIKJ', commodity }) });

  it('shows changes computed from the history, the chart and the forecast', async () => {
    render(await detail('cabai-merah-keriting'));
    // historyFixture: +50 per day up to 30 Sep (55 950); 7 days earlier: 55 600.
    const ringkasan = screen.getByRole('region', { name: 'Ringkasan perubahan' });
    expect(within(ringkasan).getByText('7 hari').closest('div')?.textContent).toContain('+0,6%');
    expect(document.querySelector('[data-series="median"]')).not.toBeNull();
    expect(document.body.textContent).toContain('Data demo');
  });

  it('shows no forecast and no invented context data for a commodity not yet covered', async () => {
    api.priceSummary.mockResolvedValue({ ok: true, data: summaryFixture() });
    api.forecast.mockResolvedValue({
      ok: true,
      data: forecastFixture({ status: 'pending_coverage', artifact: null, horizons: [] }),
    });
    api.history.mockResolvedValue({ ok: true, data: { ...historyFixture(0), points: [] } });
    render(await detail('cabai-rawit-hijau'));
    expect(document.querySelector('[data-series="median"]')).toBeNull();
    expect(
      screen.getByRole('heading', { name: /Prediksi cabai rawit hijau belum tersedia/ }),
    ).toBeTruthy();
    const context = screen.getByRole('region', { name: 'Konteks yang tersedia' });
    expect(context.textContent).not.toMatch(/\d/);
  });

  it.each(['hidden', 'unavailable'] as const)(
    'does not promise a later phase when a covered forecast is %s',
    async (status) => {
      api.forecast.mockResolvedValue({ ok: true, data: forecastFixture({ status }) });
      render(await detail('cabai-merah-keriting'));
      expect(document.querySelector('[data-series="median"]')).toBeNull();
      expect(document.body.textContent).not.toContain('tahap pengembangan berikutnya');
      expect(document.body.textContent).toContain('lolos pemeriksaan');
    },
  );

  it('rejects an unknown commodity', async () => {
    await expect(detail('kopi')).rejects.toThrow('NEXT_NOT_FOUND');
  });
});
