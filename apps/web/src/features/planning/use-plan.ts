'use client';

import { useMemo } from 'react';

import { useOutlook } from '@/features/outlook/use-outlook';
import { publicEnv } from '@/lib/env';
import { costMenu, summarisePlan, type DataMode } from '@/lib/planning/plan';

import { useGuestPlan } from './guest-plan';

/** One place where screens get the stored plan, its costs, and the outlook they used. */
export function usePlan() {
  const guest = useGuestPlan();
  const outlook = useOutlook();
  const mode: DataMode = publicEnv.NEXT_PUBLIC_DATA_MODE;

  const costed = useMemo(() => {
    if (guest.state.status !== 'ready') return [];
    return guest.state.menus.map((menu) => ({ menu, cost: costMenu(menu, mode, outlook.map) }));
  }, [guest.state, mode, outlook.map]);

  const summary = useMemo(
    () =>
      summarisePlan(
        costed.map(({ menu, cost }) => ({ cost, portions_per_day: menu.portions_per_day })),
      ),
    [costed],
  );

  return {
    ...guest,
    outlook,
    mode,
    isDemo: mode === 'demo',
    hasOutlook: outlook.map.size > 0,
    costed,
    summary,
  };
}
