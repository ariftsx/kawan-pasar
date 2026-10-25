// Display values for cost screens. Screens stay simple; every "unknown" is decided here once:
// a missing number is `null` (rendered as a dash with words), never Rp 0 (UX-04).
import { getIngredient } from '@kawan-pasar/catalog';

import { formatRupiah } from '@/lib/format';

import { riskiestIngredient } from './plan';

import type { MenuCost } from '@kawan-pasar/domain';

export function rupiahOrNull(amount: number | null | undefined): string | null {
  return amount == null ? null : formatRupiah(amount);
}

export function ingredientName(slug: string): string {
  return getIngredient(slug)?.name ?? slug;
}

export function percentOf(ratio: number): string {
  return `${String(Math.round(ratio * 100))}%`;
}

export type MenuView = {
  readonly todayPerPortion: string | null;
  readonly outlookPerPortion: string | null;
  readonly todayPerDay: string | null;
  /** Change to show next to the outlook; `null` when there is no outlook to compare. */
  readonly deltaRatio: number | null;
  readonly riskName: string | null;
  readonly riskShare: string | null;
};

/** Everything a menu card or menu header shows, with the outlook hidden when none is served. */
export function menuView(cost: MenuCost | null, hasOutlook: boolean): MenuView {
  const risk = cost === null ? null : riskiestIngredient(cost);
  const showOutlook = hasOutlook && cost !== null;
  return {
    todayPerPortion: rupiahOrNull(cost?.perPortionTodayIdr),
    outlookPerPortion: showOutlook ? rupiahOrNull(cost.perPortionOutlookIdr) : null,
    todayPerDay: rupiahOrNull(cost?.perDayTodayIdr),
    deltaRatio: showOutlook ? cost.deltaRatio : null,
    riskName: risk === null ? null : ingredientName(risk.ingredientId),
    riskShare: risk === null ? null : percentOf(risk.shareRatio),
  };
}
