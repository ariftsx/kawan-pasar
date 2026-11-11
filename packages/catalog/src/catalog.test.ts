import { describe, expect, it } from 'vitest';
import { COMMODITIES, HORIZONS, MARKETS, findCommodityBySourceRef } from './index.js';

describe('commodity catalog', () => {
  it('lists the five monitored commodities in display order', () => {
    expect(COMMODITIES.map((c) => c.name)).toEqual([
      'Cabai merah keriting',
      'Bawang merah',
      'Beras medium I',
      'Cabai rawit hijau',
      'Cabai rawit merah',
    ]);
    expect(COMMODITIES.map((c) => c.sortOrder)).toEqual([1, 2, 3, 4, 5]);
  });

  it('maps PIHPS source refs only for commodities present in the seed dataset', () => {
    expect(COMMODITIES.map((c) => c.sourceRef)).toEqual(['com_14', 'com_11', 'com_3', null, null]);
  });

  it('marks only the first three commodities as covered by the model', () => {
    expect(COMMODITIES.map((c) => c.modelCoverage)).toEqual([
      'covered',
      'covered',
      'covered',
      'pending',
      'pending',
    ]);
  });

  it('uses unique commodity codes and kilogram units', () => {
    expect(new Set(COMMODITIES.map((c) => c.code)).size).toBe(COMMODITIES.length);
    expect([...new Set(COMMODITIES.map((c) => c.unit))]).toEqual(['kg']);
  });

  it('finds a commodity by source ref and returns undefined for unknown refs', () => {
    expect(findCommodityBySourceRef('com_14')?.code).toBe('cabai-merah-keriting');
    expect(findCommodityBySourceRef('com_99')).toBeUndefined();
  });
});

describe('market catalog', () => {
  it('has Pasar Kramat Jati available and three markets coming soon', () => {
    expect(MARKETS).toEqual([
      { code: 'PIKJ', name: 'Pasar Kramat Jati', city: 'Jakarta', status: 'available' },
      { code: 'PSEN', name: 'Pasar Senen', city: 'Jakarta', status: 'coming_soon' },
      { code: 'PITT', name: 'Pasar Induk Tanah Tinggi', city: 'Tangerang', status: 'coming_soon' },
      { code: 'PBKS', name: 'Pasar Bekasi', city: 'Bekasi', status: 'coming_soon' },
    ]);
  });
});

describe('forecast horizons', () => {
  it('contains exactly the eight product horizons in days', () => {
    expect(HORIZONS).toEqual([1, 3, 7, 14, 30, 90, 180, 365]);
  });
});
