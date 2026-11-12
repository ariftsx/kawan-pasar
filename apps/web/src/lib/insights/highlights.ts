import type { CommoditySummary } from '@kawan-pasar/contracts';
import { changeDirection } from '../format';

export interface WeeklyHighlights {
  topRise: CommoditySummary | null;
  topFall: CommoditySummary | null;
  /** Direction of the 7-day forecasts that may be shown; `null` when none may be shown. */
  forecast: { up: number; down: number; flat: number; expired: boolean } | null;
}

/** Highlight cards of the home page (v0.4 "Paling naik / turun minggu ini"). */
export function weeklyHighlights(items: readonly CommoditySummary[]): WeeklyHighlights {
  let topRise: CommoditySummary | null = null;
  let topFall: CommoditySummary | null = null;
  for (const i of items) {
    const dir = changeDirection(i.change7d);
    if (i.change7d === null || dir === null || dir === 'flat') continue;
    if (dir === 'up' && (topRise?.change7d ?? 0) < i.change7d) topRise = i;
    if (dir === 'down' && (topFall?.change7d ?? 0) > i.change7d) topFall = i;
  }
  const counts = { up: 0, down: 0, flat: 0, expired: false };
  let shown = 0;
  for (const i of items) {
    const f = i.forecast7d;
    if ((f.status !== 'available' && f.status !== 'expired') || f.direction === null) continue;
    counts[f.direction] += 1;
    if (f.status === 'expired') counts.expired = true;
    shown += 1;
  }
  return { topRise, topFall, forecast: shown === 0 ? null : counts };
}
