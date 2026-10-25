'use client';

import { useState } from 'react';

import { SimulationCard } from './simulation-card';

import type { CostedMenu } from './menu-table';

/** Lets the user pick which menu the price-increase simulation runs on. */
export function SimulationSection({ menus }: { readonly menus: readonly CostedMenu[] }) {
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const priced = menus.filter(({ cost }) => cost !== null && cost.coverage.itemsPriced > 0);
  const selected = priced.find(({ menu }) => menu.id === selectedId) ?? priced[0];
  if (selected?.cost == null) return null;
  return (
    <div className="flex flex-col gap-2">
      <label className="flex flex-col gap-1 text-sm text-text-secondary md:max-w-sm">
        Menu untuk simulasi
        <select
          value={selected.menu.id}
          onChange={(event) => {
            setSelectedId(event.target.value);
          }}
          className="min-h-11 rounded-md border border-border-control bg-bg-surface px-3 text-base text-text-primary"
        >
          {priced.map(({ menu }) => (
            <option key={menu.id} value={menu.id}>
              {menu.name}
            </option>
          ))}
        </select>
      </label>
      <SimulationCard
        key={selected.menu.id}
        cost={selected.cost}
        portionsPerDay={selected.menu.portions_per_day}
      />
    </div>
  );
}
