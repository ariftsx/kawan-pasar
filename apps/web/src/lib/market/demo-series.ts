// DATA DEMO price history for the five board commodities. It only exists so the demo mode can
// show charts before the daily PIHPS ingest (F2) lands; every number it makes is labelled.
// The walk is deterministic (seeded per commodity) and ends exactly at the catalog demo price.
import { getCommodity, type CommoditySlug } from '@kawan-pasar/catalog';

/** Demo bundle origin (services/model/demo/demo__2026-10-18): the "today" of demo mode. */
export const DEMO_AS_OF = '2026-10-18';
export const DEMO_HISTORY_DAYS = 365;

export type PricePoint = { readonly date: string; readonly price: number };

type Profile = {
  readonly volatility: number;
  readonly season: number;
  readonly stickiness: number;
};

// Chilli moves most, rice barely (most days unchanged), matching the research data's shape.
const PROFILES: Record<CommoditySlug, Profile> = {
  'cabai-merah-keriting': { volatility: 0.032, season: 0.12, stickiness: 0.1 },
  'cabai-rawit-merah': { volatility: 0.035, season: 0.1, stickiness: 0.1 },
  'cabai-rawit-hijau': { volatility: 0.028, season: 0.08, stickiness: 0.15 },
  'bawang-merah': { volatility: 0.018, season: 0.06, stickiness: 0.3 },
  'beras-medium-1': { volatility: 0.004, season: 0.01, stickiness: 0.95 },
};

/** Mulberry32: small, fast, and good enough for a stable demo curve. */
function random(seed: number): () => number {
  let state = seed >>> 0;
  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function seedOf(text: string): number {
  let hash = 2166136261;
  for (const char of text) hash = Math.imul(hash ^ char.charCodeAt(0), 16777619);
  return hash >>> 0;
}

/** `YYYY-MM-DD` shifted by whole days (calendar arithmetic in UTC, no time-zone drift). */
export function shiftDate(date: string, days: number): string {
  const value = new Date(`${date}T00:00:00Z`);
  value.setUTCDate(value.getUTCDate() + days);
  return value.toISOString().slice(0, 10);
}

/** Rupiah rounded the way markets quote: to Rp 50 below Rp 20.000, else to Rp 100. */
function quote(price: number): number {
  const step = price < 20_000 ? 50 : 100;
  return Math.max(step, Math.round(price / step) * step);
}

/** Oldest first; the last point is `asOf` and equals the commodity demo price. */
export function demoSeries(
  slug: CommoditySlug,
  asOf: string = DEMO_AS_OF,
  days: number = DEMO_HISTORY_DAYS,
): readonly PricePoint[] {
  const commodity = getCommodity(slug);
  if (commodity === undefined) throw new Error(`Komoditas tidak dikenal: ${slug}`);
  const profile = PROFILES[slug];
  const next = random(seedOf(slug));
  const logs: number[] = [0];
  for (let day = 1; day < days; day += 1) {
    const stays = next() < profile.stickiness;
    const shock = (next() - 0.5) * 2 * profile.volatility;
    logs.push(stays ? (logs.at(-1) ?? 0) : (logs.at(-1) ?? 0) * 0.97 + shock);
  }
  const end = logs.at(-1) ?? 0;
  return logs.map((value, index) => {
    // Year-end festive season lifts prices; the curve is anchored so the last day is exact.
    const offset = index - (days - 1);
    const season = profile.season * Math.sin(((index + 30) / days) * 2 * Math.PI);
    const seasonEnd = profile.season * Math.sin(((days - 1 + 30) / days) * 2 * Math.PI);
    const ratio = Math.exp(value - end + season - seasonEnd);
    const price = offset === 0 ? commodity.demo_price_idr : quote(commodity.demo_price_idr * ratio);
    return { date: shiftDate(asOf, offset), price };
  });
}
