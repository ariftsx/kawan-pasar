import { describe, expect, it } from 'vitest';

import {
  horizonLabel,
  horizonShort,
  horizonStatus,
  parseHorizon,
  parseOutlook,
  visiblePoint,
} from './schema';

const body = {
  data: {
    status: 'in_development',
    forecast: {
      run: { origin: '2026-10-18', market: 'PIKJ' },
      reference_price_idr: 52_400,
      points: [
        {
          horizon_day: 7,
          target_date: '2026-10-25',
          predicted_change: 0.028,
          predicted_price_idr: 53_867,
        },
        {
          horizon_day: 365,
          target_date: '2027-10-18',
          predicted_change: 0.2,
          predicted_price_idr: 62_880,
        },
      ],
    },
  },
  provenance: {
    model_version: 'demo',
    dataset_version: 'demo',
    preprocessing_version: 'demo',
    data_cutoff: '2026-10-18T12:00:00+07:00',
    artifact_status: 'demo',
  },
  limitations: ['Bukan jaminan harga.'],
};

describe('parseOutlook', () => {
  it('accepts a forecast with full provenance and flags demo bundles', () => {
    const outlook = parseOutlook(body, 'req_1');
    expect(outlook.kind).toBe('ready');
    if (outlook.kind !== 'ready') return;
    expect(outlook.isDemo).toBe(true);
    expect(outlook.referencePrice).toBe(52_400);
  });

  it('hides a forecast without provenance or with a missing artifact', () => {
    expect(parseOutlook({ ...body, provenance: undefined }, 'req_2')).toEqual({
      kind: 'unavailable',
      requestId: 'req_2',
    });
    const missing = { ...body, data: { ...body.data, status: 'missing' } };
    expect(parseOutlook(missing, null).kind).toBe('unavailable');
  });
});

describe('horizons', () => {
  it('labels and classifies horizons', () => {
    expect(horizonLabel(7)).toBe('7 hari');
    expect(horizonLabel(365)).toBe('1 tahun');
    expect(horizonShort(365)).toBe('1T');
    expect(horizonShort(14)).toBe('14H');
    expect(horizonStatus(30)).toBe('tersedia');
    expect(horizonStatus(90)).toBe('sebagian');
    expect(horizonStatus(180)).toBe('belum-diuji');
  });

  it('parses horizon query values with a fallback', () => {
    expect(parseHorizon('30')).toBe(30);
    expect(parseHorizon('2')).toBe(7);
    expect(parseHorizon(undefined, 1)).toBe(1);
  });

  it('never shows an untested long horizon', () => {
    const outlook = parseOutlook(body, null);
    if (outlook.kind !== 'ready') throw new Error('expected ready');
    expect(visiblePoint(outlook.points, 7)?.predicted_price_idr).toBe(53_867);
    expect(visiblePoint(outlook.points, 365)).toBeNull();
    expect(visiblePoint(outlook.points, 14)).toBeNull();
  });
});

describe('context availability', () => {
  it('defaults every modality to missing when the API omits it', () => {
    const outlook = parseOutlook(body, null);
    if (outlook.kind !== 'ready') throw new Error('expected ready');
    expect(outlook.availability.climate).toBe('missing');
    const withContext = parseOutlook(
      {
        ...body,
        availability: {
          price: 'available',
          climate: 'partial',
          news: 'missing',
          macro_logistics: 'missing',
          calendar: 'available',
        },
      },
      null,
    );
    if (withContext.kind !== 'ready') throw new Error('expected ready');
    expect(withContext.availability.climate).toBe('partial');
  });
});
