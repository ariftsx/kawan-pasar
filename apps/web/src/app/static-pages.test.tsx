import { render, screen, within } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { ACCURACY, ACCURACY_BY_HORIZON, ACCURACY_HORIZONS } from '@/content/arif-net';

/** The model the product runs (written by services/model-arifnet/tools/convert_from_arifnet.py). */
const SPEC = JSON.parse(
  readFileSync(
    // Vitest runs from apps/web.
    path.resolve(process.cwd(), '../../services/model-arifnet/model/arifnet-a0.json'),
    'utf8',
  ),
) as {
  horizons: number[];
  commodities: { id: string; code: string }[];
  validation: {
    overall: number;
    best_baseline: { model: string; relmae: number };
    by_commodity: Record<string, Record<string, number>>;
  };
};

vi.mock('next/navigation', () => ({
  usePathname: () => '/arif-net',
  useRouter: () => ({ refresh: vi.fn(), push: vi.fn() }),
}));

const fetchSpy = vi.spyOn(globalThis, 'fetch');

afterEach(() => {
  fetchSpy.mockClear();
});

describe('ARIF-Net accuracy data', () => {
  it('shows the validation results of ARIF-Net v1.1.0 (relMAE, folds F1-F2, 5 seeds)', () => {
    expect(ACCURACY.map((r) => [r.model, r.relMae])).toEqual([
      ['ARIF-Net (A0)', 0.85],
      ['BiLSTM', 0.863],
      ['Ridge', 0.874],
      ['Random forest', 0.88],
      ['LightGBM', 0.887],
      ['SVR', 0.897],
      ['Temporal fusion transformer', 0.899],
      ['GRU', 0.909],
      ['Persistence', 1],
    ]);
  });

  it('agrees with the model the product runs (arifnet-a0.json)', () => {
    expect(ACCURACY[0]?.relMae).toBe(Math.round(SPEC.validation.overall * 1000) / 1000);
    expect(SPEC.validation.best_baseline.model).toBe('bilstm');
    expect(ACCURACY[1]?.relMae).toBe(
      Math.round(SPEC.validation.best_baseline.relmae * 1000) / 1000,
    );
    expect([...ACCURACY_HORIZONS]).toEqual(SPEC.horizons);
    const ids = ['com_14', 'com_11', 'com_3'];
    ACCURACY_BY_HORIZON.forEach((row, i) => {
      const cells = SPEC.validation.by_commodity[ids[i] ?? ''] ?? {};
      expect(row.relMae, row.commodity).toEqual(SPEC.horizons.map((h) => cells[String(h)]));
    });
  });
});

describe('static pages', () => {
  it('ARIF-Net shows the accuracy table with its source and the caveat, without calling the API', async () => {
    const { default: ArifNet } = await import('./arif-net/page');
    render(ArifNet());
    const table = screen.getByRole('table', { name: /model pembanding/i });
    expect(within(table).getByText('0,850')).toBeTruthy();
    expect(document.body.textContent).toContain('ARIF-Net v1.1.0');
    expect(document.body.textContent).toContain('0,013');
    const cells = screen.getByRole('table', { name: /per komoditas dan horizon/i });
    expect(within(cells).getAllByRole('row')).toHaveLength(4);
    expect(within(cells).getByText('0,674')).toBeTruthy();
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
