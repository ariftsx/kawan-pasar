import { COMMODITIES, MARKETS } from '@kawan-pasar/catalog';
import type { Commodity, Market } from '@kawan-pasar/catalog';
import { notFound } from './api-errors.js';

/**
 * Resolves route params against the catalog (the source of truth that also seeds the database).
 * Unknown or malformed codes are a 404, so callers learn nothing beyond "no such resource".
 */
export function resolveMarket(code: string): Market {
  const market = MARKETS.find((m) => m.code === code);
  if (market === undefined) throw notFound();
  return market;
}

export function resolveCommodity(code: string): Commodity {
  const commodity = COMMODITIES.find((c) => c.code === code);
  if (commodity === undefined) throw notFound();
  return commodity;
}

export const toMarketDto = (m: Market): Market => ({
  code: m.code,
  name: m.name,
  city: m.city,
  status: m.status,
});
