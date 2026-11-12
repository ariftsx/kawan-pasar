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
import { commodityTone, dataStatusNote } from './commodity-display';

/**
 * Desktop/tablet price card (v0.4 CommodityCard). The whole card is clickable through the name
 * link (stretched), so screen readers hear one link with the commodity name.
 */
export function CommodityCard({ item, href }: { item: CommoditySummary; href: Route }): ReactNode {
  const note = dataStatusNote(item);
  return (
    <article className="relative flex min-w-0 flex-col gap-3.5 rounded-xl border border-line bg-surface p-5 transition-shadow focus-within:shadow-[0_0_0_3px_var(--color-terong-600)] hover:shadow-[0_6px_20px_#14201A0F]">
      <div className="flex items-start justify-between gap-2">
        <IconBox tone={commodityTone(item.code)}>
          <CommodityIcon code={item.code} size={38} />
        </IconBox>
        <span className="flex flex-col items-end gap-1">
          <Delta value={item.change7d} />
          {item.dataStatus === 'stale' ? (
            <Chip tone="kunyit" size="S">
              Terlambat
            </Chip>
          ) : null}
        </span>
      </div>
      <h3 className="text-heading-card-16">
        <Link
          href={href}
          className="after:absolute after:inset-0 after:rounded-xl focus-visible:outline-none"
        >
          {item.name}
        </Link>
      </h3>
      <div className="flex flex-col gap-1">
        <Price value={item.latest?.priceIdr ?? null} size="m" />
        <span className="text-[12px] text-muted-text">{note}</span>
      </div>
      {/* The line spans the last 30 observations, so it is coloured by the 30-day change. */}
      <Sparkline points={item.sparkline} direction={changeDirection(item.change30d)} />
      <hr className="border-line" />
      <div className="flex items-center justify-between gap-2">
        <span className="text-[12px] font-medium text-muted-text">Prediksi 7 hari</span>
        <PredictionBadge status={item.forecast7d.status} q50Change={item.forecast7d.q50Change} />
      </div>
    </article>
  );
}
