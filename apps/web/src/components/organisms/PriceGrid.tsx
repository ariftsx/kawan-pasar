import type { CommoditySummary } from '@kawan-pasar/contracts';
import type { ReactNode } from 'react';
import { CommodityCard } from '../molecules/CommodityCard';
import { CommodityRow } from '../molecules/CommodityRow';
import { hrefs } from '@/lib/hrefs';

/**
 * Today's prices: cards from 640 px, a compact list below (v0.4 Beranda/Harga). Items carry
 * `data-coverage` / `data-name` for CommodityFilter.
 */
export function PriceGrid({
  id,
  items,
}: {
  id: string;
  items: readonly CommoditySummary[];
}): ReactNode {
  return (
    <div id={id} data-filter="all">
      <ul className="hidden gap-4 sm:grid sm:grid-cols-[repeat(2,minmax(0,1fr))] lg:grid-cols-[repeat(3,minmax(0,1fr))] xl:grid-cols-[repeat(5,minmax(0,1fr))]">
        {items.map((i) => (
          <li
            key={i.code}
            data-coverage={i.modelCoverage}
            data-name={i.name.toLowerCase()}
            className="min-w-0"
          >
            <CommodityCard item={i} href={hrefs.price(i.code)} />
          </li>
        ))}
      </ul>
      <ul className="divide-y divide-line overflow-hidden rounded-xl border border-line sm:hidden">
        {items.map((i) => (
          <li key={i.code} data-coverage={i.modelCoverage} data-name={i.name.toLowerCase()}>
            <CommodityRow item={i} href={hrefs.price(i.code)} />
          </li>
        ))}
      </ul>
    </div>
  );
}
