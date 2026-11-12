import type { CommoditySummary } from '@kawan-pasar/contracts';
import Link from 'next/link';
import type { ReactNode } from 'react';
import { CommodityIcon } from '@/brand/CommodityIcon';
import { changeDirection } from '@/lib/format';
import { hrefs } from '@/lib/hrefs';
import { Chip } from '../atoms/Chip';
import { Delta } from '../atoms/Delta';
import { IconBox } from '../atoms/IconBox';
import { PredictionBadge } from '../atoms/PredictionBadge';
import { Price } from '../atoms/Price';
import { Sparkline } from '../atoms/Sparkline';
import { commodityTone, dataStatusNote } from '../molecules/commodity-display';
import { CommodityRow } from '../molecules/CommodityRow';

/**
 * Price table (v0.4 Harga): a table from 768 px, the compact list below. Items carry
 * `data-coverage` / `data-name` for CommodityFilter.
 */
export function PriceTable({
  id,
  caption,
  items,
}: {
  id: string;
  caption: string;
  items: readonly CommoditySummary[];
}): ReactNode {
  return (
    <div id={id} data-filter="all">
      <div
        tabIndex={0}
        role="region"
        aria-label={`${caption} (bisa digeser)`}
        className="relative hidden overflow-x-auto rounded-xl border border-line bg-surface md:block"
      >
        <table className="w-full text-left">
          <caption className="sr-only">{caption}</caption>
          <thead className="bg-surface-2 text-overline-11 text-muted-text uppercase">
            <tr>
              <th scope="col" className="px-5 py-3">
                Komoditas
              </th>
              <th scope="col" className="px-3 py-3">
                Tren 30 hari
              </th>
              <th scope="col" className="px-3 py-3 text-right">
                Harga hari ini
              </th>
              <th scope="col" className="px-3 py-3">
                7 hari
              </th>
              <th scope="col" className="px-3 py-3">
                30 hari
              </th>
              <th scope="col" className="px-5 py-3">
                Prediksi 7 hari
              </th>
            </tr>
          </thead>
          <tbody>
            {items.map((i) => (
              <tr
                key={i.code}
                data-coverage={i.modelCoverage}
                data-name={i.name.toLowerCase()}
                className="border-t border-line"
              >
                <th scope="row" className="px-5 py-3 font-normal">
                  <Link href={hrefs.price(i.code)} className="flex items-center gap-3">
                    <IconBox tone={commodityTone(i.code)} size={40}>
                      <CommodityIcon code={i.code} size={30} />
                    </IconBox>
                    <span className="flex flex-col">
                      <span className="text-sm font-bold">{i.name}</span>
                      <span className="text-[12px] text-muted-text">{dataStatusNote(i)}</span>
                    </span>
                  </Link>
                </th>
                <td className="w-40 px-3 py-3">
                  <Sparkline
                    points={i.sparkline}
                    direction={changeDirection(i.change30d)}
                    width={140}
                  />
                </td>
                <td className="px-3 py-3 text-right">
                  <Price value={i.latest?.priceIdr ?? null} size="s" />
                  {i.dataStatus === 'stale' ? (
                    <span className="mt-1 block">
                      <Chip tone="kunyit" size="S">
                        Terlambat
                      </Chip>
                    </span>
                  ) : null}
                </td>
                <td className="px-3 py-3">
                  <Delta value={i.change7d} />
                </td>
                <td className="px-3 py-3">
                  <Delta value={i.change30d} />
                </td>
                <td className="px-5 py-3">
                  <PredictionBadge
                    status={i.forecast7d.status}
                    q50Change={i.forecast7d.q50Change}
                  />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <ul className="divide-y divide-line overflow-hidden rounded-xl border border-line md:hidden">
        {items.map((i) => (
          <li key={i.code} data-coverage={i.modelCoverage} data-name={i.name.toLowerCase()}>
            <CommodityRow item={i} href={hrefs.price(i.code)} />
          </li>
        ))}
      </ul>
    </div>
  );
}
