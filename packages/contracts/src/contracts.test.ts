import { describe, expect, it } from 'vitest';
import {
  ApiErrorSchema,
  BundleForecastRowSchema,
  CommoditySummarySchema,
  HistoryQuerySchema,
} from './index.js';

const summary = {
  code: 'cabai-rawit-hijau',
  name: 'Cabai rawit hijau',
  unit: 'kg',
  modelCoverage: 'pending',
  dataStatus: 'no_data',
  latest: null,
  change7d: null,
  change30d: null,
  sparkline: [],
  forecast7d: { status: 'pending_coverage', q50Change: null, direction: null },
};

const row = {
  market_code: 'PIKJ',
  commodity_code: 'cabai-merah-keriting',
  base_date: '2026-09-30',
  horizon_days: 7,
  q10_change: -0.02,
  q50_change: 0.01,
  q90_change: 0.05,
  q10_price_idr: 61_887,
  q50_price_idr: 63_782,
  q90_price_idr: 66_308,
  eval_status: 'available',
};

describe('HistoryQuerySchema', () => {
  it('defaults the range to 90 days', () => {
    expect(HistoryQuerySchema.parse({})).toEqual({ range: '90d' });
  });

  it('rejects unknown ranges', () => {
    expect(HistoryQuerySchema.safeParse({ range: '7d' }).success).toBe(false);
  });

  it('rejects unknown properties', () => {
    expect(HistoryQuerySchema.safeParse({ range: '30d', x: 1 }).success).toBe(false);
  });
});

describe('CommoditySummarySchema', () => {
  it('accepts unknown values as null', () => {
    expect(CommoditySummarySchema.safeParse(summary).success).toBe(true);
  });

  it('rejects a zero price', () => {
    const zero = {
      ...summary,
      dataStatus: 'fresh',
      latest: { observedOn: '2026-09-30', priceIdr: 0 },
    };
    expect(CommoditySummarySchema.safeParse(zero).success).toBe(false);
  });
});

describe('BundleForecastRowSchema', () => {
  it('accepts a valid row', () => {
    expect(BundleForecastRowSchema.safeParse(row).success).toBe(true);
  });

  it('rejects non-monotonic quantiles', () => {
    expect(
      BundleForecastRowSchema.safeParse({ ...row, q10_change: 0.05, q50_change: 0.02 }).success,
    ).toBe(false);
  });

  it('rejects horizons outside the product horizons', () => {
    expect(BundleForecastRowSchema.safeParse({ ...row, horizon_days: 2 }).success).toBe(false);
  });

  it('accepts a row whose quantiles are all unknown', () => {
    const unknown = {
      ...row,
      q10_change: null,
      q50_change: null,
      q90_change: null,
      q10_price_idr: null,
      q50_price_idr: null,
      q90_price_idr: null,
    };
    expect(BundleForecastRowSchema.safeParse(unknown).success).toBe(true);
  });
});

describe('ApiErrorSchema', () => {
  it('rejects unknown error codes', () => {
    expect(ApiErrorSchema.safeParse({ error: { code: 'teapot', message: 'x' } }).success).toBe(
      false,
    );
  });
});

describe('BundleForecastRowSchema with partially unknown quantiles', () => {
  it('still checks the order of the quantiles that are known', () => {
    expect(
      BundleForecastRowSchema.safeParse({
        ...row,
        q10_change: 0.05,
        q50_change: null,
        q90_change: 0.01,
      }).success,
    ).toBe(false);
  });

  it('accepts known quantiles in order around an unknown median', () => {
    expect(
      BundleForecastRowSchema.safeParse({
        ...row,
        q10_change: -0.01,
        q50_change: null,
        q90_change: 0.02,
      }).success,
    ).toBe(true);
  });
});
