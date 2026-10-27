'use client';

import { getIngredient } from '@kawan-pasar/catalog';
import { Link } from 'react-aria-components';

import { formatRupiah } from '@/lib/format';
import { riskiestIngredient } from '@/lib/planning/plan';

import type { GuestMenu } from '@/lib/guest-store/schema';
import type { MenuCost } from '@kawan-pasar/domain';

export type CostedMenu = { readonly menu: GuestMenu; readonly cost: MenuCost | null };

function riskLabel(cost: MenuCost | null): string {
  const risk = cost === null ? null : riskiestIngredient(cost);
  if (risk === null) return '—';
  const name = getIngredient(risk.ingredientId)?.name ?? risk.ingredientId;
  return `${name} (${String(Math.round(risk.shareRatio * 100))}%)`;
}

function MenuRow({ menu, cost, hasOutlook }: CostedMenu & { readonly hasOutlook: boolean }) {
  return (
    <tr className="border-b border-border-default last:border-b-0">
      <th scope="row" className="py-3 pr-3 text-left font-medium">
        <Link
          href={`/rencana/${menu.id}`}
          className="text-text-brand outline-none data-[focus-visible]:outline-2 data-[focus-visible]:outline-border-focus data-[hovered]:underline"
        >
          {menu.name}
        </Link>
      </th>
      <td className="py-3 pr-3 text-right tabular-nums">{menu.portions_per_day}</td>
      <td className="py-3 pr-3 text-right tabular-nums">
        {formatRupiah(cost?.perPortionTodayIdr ?? null)}
      </td>
      <td className="py-3 pr-3 text-right tabular-nums text-text-brand">
        {hasOutlook ? formatRupiah(cost?.perPortionOutlookIdr ?? null) : '—'}
      </td>
      <td className="py-3 pr-3 text-right tabular-nums">
        {formatRupiah(cost?.perDayTodayIdr ?? null)}
      </td>
      <td className="py-3 text-text-secondary">{riskLabel(cost)}</td>
    </tr>
  );
}

const HEADERS = [
  ['Menu', 'text-left'],
  ['Porsi/hari', 'text-right'],
  ['Modal/porsi', 'text-right'],
  ['Perkiraan 7 hari', 'text-right'],
  ['Modal/hari', 'text-right'],
  ['Bahan paling berisiko', 'text-left'],
] as const;

/** Menu table (docs 09 §5.2); numeric columns align right and scroll sideways on mobile. */
export function MenuTable({
  menus,
  hasOutlook,
}: {
  readonly menus: readonly CostedMenu[];
  readonly hasOutlook: boolean;
}) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-xl text-sm">
        <thead>
          <tr className="border-b border-border-strong text-xs text-text-secondary">
            {HEADERS.map(([label, align]) => (
              <th key={label} scope="col" className={`py-2 pr-3 font-medium ${align}`}>
                {label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {menus.map(({ menu, cost }) => (
            <MenuRow key={menu.id} menu={menu} cost={cost} hasOutlook={hasOutlook} />
          ))}
        </tbody>
      </table>
    </div>
  );
}
