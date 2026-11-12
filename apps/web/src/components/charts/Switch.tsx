'use client';

import { useState, useSyncExternalStore } from 'react';
import type { ReactNode } from 'react';
import { HorizonPill } from '../atoms/HorizonPill';

export interface SwitchOption {
  value: string;
  short: string;
  long: string;
}

const noSubscription = (): (() => void) => () => undefined;

/**
 * Pills that only set `data-active-<name>` on a server-rendered wrapper (charts.css shows the
 * matching variant). No data lives here. Rendered only after hydration: without JavaScript the
 * server default stays visible and no dead buttons are shown.
 */
export function Switch({
  targetId,
  name,
  label,
  options,
  defaultValue,
}: {
  targetId: string;
  name: 'range' | 'horizon';
  label: string;
  options: readonly SwitchOption[];
  defaultValue: string;
}): ReactNode {
  const hydrated = useSyncExternalStore(
    noSubscription,
    () => true,
    () => false,
  );
  const [active, setActive] = useState(defaultValue);
  if (!hydrated) return null;
  return (
    <div
      role="group"
      aria-label={label}
      className="flex flex-wrap gap-1 rounded-full bg-surface-2 p-1"
    >
      {options.map((o) => (
        <HorizonPill
          key={o.value}
          label={o.short}
          longLabel={o.long}
          active={active === o.value}
          onClick={() => {
            setActive(o.value);
            const el = document.getElementById(targetId);
            if (el !== null) el.setAttribute(`data-active-${name}`, o.value);
          }}
        />
      ))}
    </div>
  );
}
