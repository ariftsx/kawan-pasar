import { afterEach, describe, expect, it, vi } from 'vitest';

import { param, withQuery } from './route';

const apiGet = vi.fn();

vi.mock('@/lib/api/client', () => ({
  apiGet: (...args: unknown[]) => apiGet(...args) as unknown,
  newRequestId: () => 'req_test',
}));
vi.mock('next/server', () => ({ connection: () => Promise.resolve() }));
vi.mock('@/lib/env/server', () => ({
  serverEnv: () => ({ API_INTERNAL_URL: 'http://api:4000', SERVICE_TOKEN: 'x'.repeat(32) }),
}));
vi.mock('@/lib/env', () => ({
  publicEnv: { NEXT_PUBLIC_APP_URL: 'http://localhost:3000', NEXT_PUBLIC_DATA_MODE: 'demo' },
}));

const body = {
  data: {
    status: 'in_development',
    forecast: {
      run: { origin: '2026-10-18', market: 'PIKJ' },
      reference_price_idr: 52400,
      points: [
        {
          horizon_day: 7,
          target_date: '2026-10-25',
          predicted_change: 0.03,
          predicted_price_idr: 53972,
        },
      ],
    },
  },
  provenance: {
    model_version: 'arif-net-a0',
    dataset_version: 'demo',
    preprocessing_version: 'p1',
    data_cutoff: '2026-10-18',
    artifact_status: 'candidate',
  },
  limitations: [],
};

afterEach(() => {
  apiGet.mockReset();
});

describe('route helpers', () => {
  it('builds a query string and keeps a bare path', () => {
    expect(withQuery('/prediksi', { komoditas: 'bawang-merah', horizon: '7' })).toBe(
      '/prediksi?komoditas=bawang-merah&horizon=7',
    );
    expect(withQuery('/harga', {})).toBe('/harga');
  });

  it('takes the first value of a search param', () => {
    expect(param(['a', 'b'])).toBe('a');
    expect(param('c')).toBe('c');
    expect(param(undefined)).toBeUndefined();
  });
});

describe('server helpers', () => {
  it('reads the board for the configured data mode', async () => {
    const { currentBoard, isDemoMode } = await import('./server');
    expect(isDemoMode()).toBe(true);
    expect(currentBoard().status).toBe('demo');
  });

  it('fetches an outlook per forecastable commodity', async () => {
    apiGet.mockResolvedValue({ status: 200, body, requestId: 'req_test' });
    const { forecastOutlooks } = await import('./server');
    const outlooks = await forecastOutlooks();
    expect([...outlooks.keys()]).toEqual([
      'cabai-merah-keriting',
      'bawang-merah',
      'beras-medium-1',
    ]);
    expect(outlooks.get('bawang-merah')?.kind).toBe('ready');
    expect(apiGet).toHaveBeenCalledWith(expect.anything(), '/v1/outlook/bawang-merah', 'req_test');
  });

  it('hides the forecast when the api fails', async () => {
    apiGet.mockResolvedValue({ status: 503, body: {}, requestId: 'req_x' });
    const { getOutlook } = await import('@/lib/outlook/server');
    await expect(getOutlook('bawang-merah')).resolves.toEqual({
      kind: 'unavailable',
      requestId: 'req_x',
    });
  });
});
