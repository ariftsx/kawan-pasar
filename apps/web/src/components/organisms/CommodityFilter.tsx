'use client';

import { useRef, useState, useSyncExternalStore } from 'react';
import type { ReactNode } from 'react';
import { cx } from '@/lib/cx';

const noSubscription = (): (() => void) => () => undefined;

/**
 * "Semua / Bisa diprediksi" tabs and an optional name search over a server-rendered list. It only
 * sets attributes (`data-filter` on the list, `data-filtered-out` on items); charts.css hides
 * them. Without JavaScript nothing is rendered here and every commodity stays visible.
 */
export function CommodityFilter({
  targetId,
  total,
  covered,
  search = false,
}: {
  targetId: string;
  total: number;
  covered: number;
  search?: boolean;
}): ReactNode {
  const hydrated = useSyncExternalStore(
    noSubscription,
    () => true,
    () => false,
  );
  const [mode, setMode] = useState<'all' | 'covered'>('all');
  const query = useRef('');
  // The query that matched nothing (shown in the status message), or '' when something matches.
  const [noMatch, setNoMatch] = useState('');
  if (!hydrated) return null;

  const apply = (nextMode: 'all' | 'covered', query: string): void => {
    const list = document.getElementById(targetId);
    if (list === null) return;
    list.setAttribute('data-filter', nextMode);
    const q = query.trim().toLowerCase();
    let visible = 0;
    for (const item of list.querySelectorAll<HTMLElement>('[data-name]')) {
      const match = q === '' || (item.dataset['name'] ?? '').includes(q);
      item.toggleAttribute('data-filtered-out', !match);
      // Same rule as charts.css: the coverage tab hides commodities still awaiting a forecast.
      const shownByTab = nextMode === 'all' || item.dataset['coverage'] !== 'pending';
      if (match && shownByTab) visible += 1;
    }
    setNoMatch(q !== '' && visible === 0 ? query.trim() : '');
  };

  return (
    <div className="flex flex-wrap items-center gap-3">
      <div
        role="group"
        aria-label="Saring komoditas"
        className="flex gap-1 rounded-full bg-surface-2 p-1"
      >
        {(
          [
            ['all', `Semua (${String(total)})`],
            ['covered', `Bisa diprediksi (${String(covered)})`],
          ] as const
        ).map(([value, label]) => (
          <button
            key={value}
            type="button"
            aria-pressed={mode === value}
            onClick={() => {
              setMode(value);
              apply(value, query.current);
            }}
            className={cx(
              'min-h-11 rounded-full px-3 text-[13px] font-bold',
              mode === value
                ? 'bg-surface text-ink shadow-[0_1px_3px_#14201A14]'
                : 'text-muted-text',
            )}
          >
            {label}
          </button>
        ))}
      </div>
      {search ? (
        <label className="flex min-h-11 min-w-0 flex-1 basis-48 items-center gap-2 rounded-full border border-line bg-surface px-4">
          <span className="sr-only">Cari komoditas</span>
          <input
            type="search"
            placeholder="Cari komoditas…"
            className="min-w-0 flex-1 bg-transparent text-[15px] outline-none"
            onChange={(e) => {
              query.current = e.currentTarget.value;
              apply(mode, query.current);
            }}
          />
        </label>
      ) : null}
      <p role="status" className="basis-full text-body-small-13 text-muted-text empty:hidden">
        {noMatch === '' ? '' : `Tidak ada komoditas yang cocok dengan “${noMatch}”.`}
      </p>
    </div>
  );
}
