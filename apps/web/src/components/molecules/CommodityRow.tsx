import type { CommoditySummary } from '@kawan-pasar/contracts';
import type { Route } from 'next';
import Link from 'next/link';
import type { ReactNode } from 'react';
import { CommodityIcon } from '@/brand/CommodityIcon';
import { changeDirection } from '@/lib/format';
import { Chip } from '../atoms/Chip';
import { Delta } from '../atoms/Delta';
import { IconBox } from '../atoms/IconBox';
import { PredictionBadge } from '../atoms/PredictionBadge';
import { Price } from '../atoms/Price';
import { Sparkline } from '../atoms/Sparkline';
import { commodityTone } from './commodity-display';

/** Mobile list row (v0.4 CommodityRow/Mobile). The whole row is one link. */
export function CommodityRow({ item, href }: { item: CommoditySummary; href: Route }): ReactNode {
  return (
    <Link
      href={href}
      className="flex min-h-16 items-center gap-3 bg-surface p-3 transition-colors hover:bg-surface-2"
    >
      <IconBox tone={commodityTone(item.code)} size={40}>
        <CommodityIcon code={item.code} size={30} />
      </IconBox>
      <span className="flex min-w-0 flex-1 flex-col items-start gap-1">
        <span className="w-full truncate text-[13px] font-bold">{item.name}</span>
        <span className="flex flex-wrap items-center gap-1">
          <PredictionBadge status={item.forecast7d.status} q50Change={item.forecast7d.q50Change} />
          {item.dataStatus === 'stale' ? (
            <Chip tone="kunyit" size="S">
              Terlambat
            </Chip>
          ) : null}
        </span>
      </span>
      <span className="hidden w-11 shrink-0 min-[380px]:block">
        <Sparkline
          points={item.sparkline}
          direction={changeDirection(item.change30d)}
          width={44}
          height={20}
        />
      </span>
      <span className="flex shrink-0 flex-col items-end gap-1">
        <Price value={item.latest?.priceIdr ?? null} size="s" />
        <Delta value={item.change7d} size="S" />
      </span>
    </Link>
  );
}
