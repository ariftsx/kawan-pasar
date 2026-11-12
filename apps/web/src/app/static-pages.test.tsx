import { render, screen, within } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { ACCURACY } from '@/content/arif-net';

vi.mock('next/navigation', () => ({
  usePathname: () => '/arif-net',
  useRouter: () => ({ refresh: vi.fn(), push: vi.fn() }),
}));

const fetchSpy = vi.spyOn(globalThis, 'fetch');

afterEach(() => {
  fetchSpy.mockClear();
});

describe('ARIF-Net accuracy data', () => {
  it('matches Table 4.5 of the v04 report exactly (relMAE, validation F1-F2, 5 seeds)', () => {
    expect(ACCURACY.map((r) => [r.model, r.relMae])).toEqual([
      ['ARIF-Net (A0)', 0.85],
      ['BiLSTM', 0.861],
      ['Ridge', 0.874],
      ['Random forest', 0.876],
      ['LightGBM', 0.881],
      ['SVR', 0.897],
      ['GRU', 0.911],
      ['Temporal fusion transformer', 0.911],
      ['Persistence', 1],
    ]);
  });
});

describe('static pages', () => {
  it('ARIF-Net shows the accuracy table with its source and the caveat, without calling the API', async () => {
    const { default: ArifNet } = await import('./arif-net/page');
    render(ArifNet());
    const table = screen.getByRole('table', { name: /akurasi/i });
    expect(within(table).getByText('0,850')).toBeTruthy();
    expect(document.body.textContent).toContain('Tabel 4.5');
    expect(document.body.textContent).toContain('0,011');
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it('Keterbatasan lists the four kinds of limits', async () => {
    const { default: Keterbatasan } = await import('./arif-net/keterbatasan/page');
    render(Keterbatasan());
    for (const h of ['Data', 'Model', 'Cara membaca', 'Produk']) {
      expect(screen.getByRole('heading', { name: h })).toBeTruthy();
    }
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it('Lainnya links to every secondary section', async () => {
    const { default: Lainnya } = await import('./lainnya/page');
    render(Lainnya());
    for (const name of [/Peringatan/, /Kenalan dengan ARIF-Net/, /Cakupan data/, /Edukasi/]) {
      expect(screen.getByRole('link', { name })).toBeTruthy();
    }
  });
});
