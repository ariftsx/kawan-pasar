import { describe, expect, it } from 'vitest';

import {
  defaultMarket,
  getCommodity,
  isCommoditySlug,
  listCommodities,
  listMarkets,
  modelCommodities,
} from './index.js';

describe('market catalog', () => {
  it('lists five commodities, three of them forecast by ARIF-Net', () => {
    expect(listCommodities()).toHaveLength(5);
    const forecast = listCommodities().filter((item) => item.forecast === 'available');
    expect(forecast.map((item) => item.slug)).toEqual([...modelCommodities()]);
  });

  it('keeps demo prices equal to the ingredient catalog for the model commodities', () => {
    expect(getCommodity('cabai-merah-keriting')?.demo_price_idr).toBe(52_400);
    expect(getCommodity('bawang-merah')?.demo_price_idr).toBe(38_933);
    expect(getCommodity('nope')).toBeUndefined();
  });

  it('recognises commodity slugs', () => {
    expect(isCommoditySlug('beras-medium-1')).toBe(true);
    expect(isCommoditySlug('beras')).toBe(false);
  });

  it('serves Pasar Kramat Jati as the only available market', () => {
    expect(defaultMarket().code).toBe('PIKJ');
    expect(listMarkets().filter((item) => item.status === 'available')).toHaveLength(1);
  });
});
