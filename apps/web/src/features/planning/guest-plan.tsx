'use client';

// Guest plan state for every screen (docs 12 §4: guest mode = client + IndexedDB). Screens read
// the snapshot and call the actions; nothing here ever leaves the device.
import {
  createContext,
  use,
  useCallback,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';

import {
  IdbPlanningRepository,
  type PlanningRepository,
  type PlanningSnapshot,
} from '@/lib/guest-store/repository';

import type { GuestMenu, GuestWarung } from '@/lib/guest-store/schema';

export type GuestPlanState =
  | { readonly status: 'loading' }
  | { readonly status: 'error' }
  | ({ readonly status: 'ready' } & PlanningSnapshot);

type GuestPlanActions = {
  readonly saveWarung: (warung: GuestWarung) => Promise<void>;
  readonly saveMenu: (menu: GuestMenu) => Promise<void>;
  readonly deleteMenu: (id: string) => Promise<void>;
  readonly exportJson: () => Promise<string>;
  readonly reset: () => Promise<void>;
};

type GuestPlanContext = { readonly state: GuestPlanState } & GuestPlanActions;

const Context = createContext<GuestPlanContext | null>(null);

export function GuestPlanProvider({
  children,
  repository,
}: {
  readonly children: ReactNode;
  readonly repository?: PlanningRepository;
}) {
  const [repo] = useState<PlanningRepository>(() => repository ?? new IdbPlanningRepository());
  const [state, setState] = useState<GuestPlanState>({ status: 'loading' });

  const refresh = useCallback(async () => {
    try {
      setState({ status: 'ready', ...(await repo.load()) });
    } catch {
      // Private browsing or blocked storage: the screens explain it instead of crashing.
      setState({ status: 'error' });
    }
  }, [repo]);

  // First load: state is set from the promise callback, never synchronously in the effect.
  useEffect(() => {
    let isCurrent = true;
    repo.load().then(
      (snapshot) => {
        if (isCurrent) setState({ status: 'ready', ...snapshot });
      },
      () => {
        if (isCurrent) setState({ status: 'error' });
      },
    );
    return () => {
      isCurrent = false;
    };
  }, [repo]);

  const value = useMemo<GuestPlanContext>(
    () => ({
      state,
      saveWarung: async (warung) => {
        await repo.saveWarung(warung);
        await refresh();
      },
      saveMenu: async (menu) => {
        await repo.saveMenu(menu);
        await refresh();
      },
      deleteMenu: async (id) => {
        await repo.deleteMenu(id);
        await refresh();
      },
      exportJson: async () => JSON.stringify(await repo.exportAll(), null, 2),
      reset: async () => {
        await repo.clear();
        await refresh();
      },
    }),
    [repo, refresh, state],
  );

  return <Context value={value}>{children}</Context>;
}

export function useGuestPlan(): GuestPlanContext {
  const context = use(Context);
  if (context === null) throw new Error('useGuestPlan must be used inside GuestPlanProvider');
  return context;
}
