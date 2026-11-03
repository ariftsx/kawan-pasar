import { cn } from '@kawan-pasar/ui';
import Link from 'next/link';

import { CommodityIcon } from '@/components/brand/commodity-icon';
import { formatRupiah } from '@/lib/format';

import { ChangeTag, FOCUS, StatusChip } from './blocks';
import { Sparkline } from './charts';

import type { BoardRow } from '@/lib/market/board';
import type { Route } from 'next';

const TILE: Record<string, string> = {
  'cabai-merah-keriting': 'bg-accent-chili-bg',
  'cabai-rawit-merah': 'bg-accent-chili-bg',
  'bawang-merah': 'bg-accent-chili-bg',
  'beras-medium-1': 'bg-bg-brand-subtle',
  'cabai-rawit-hijau': 'bg-bg-brand-subtle',
};

export function CommodityTile({
  slug,
  className,
}: {
  readonly slug: BoardRow['commodity']['slug'];
  readonly className?: string;
}) {
  return (
    <span
      className={cn(
        'flex size-12 shrink-0 items-center justify-center rounded-2xl',
        TILE[slug],
        className,
      )}
    >
      <CommodityIcon slug={slug} />
    </span>
  );
}

export function ForecastBadge({ row }: { readonly row: BoardRow }) {
  return row.commodity.forecast === 'available' ? (
    <StatusChip tone="forecast">★ Bisa diprediksi</StatusChip>
  ) : (
    <StatusChip tone="neutral">Prediksi menyusul</StatusChip>
  );
}

/** Card on the Beranda price grid; the whole card links to the commodity detail. */
export function CommodityCard({ row }: { readonly row: BoardRow }) {
  return (
    <Link
      href={`/harga/${row.commodity.slug}` as Route}
      className={cn(
        'flex flex-col gap-4 rounded-3xl border border-border-default bg-bg-surface p-5 hover:border-border-brand',
        FOCUS,
      )}
    >
      <span className="flex items-start justify-between gap-2">
        <CommodityTile slug={row.commodity.slug} />
        <ForecastBadge row={row} />
      </span>
      <span className="flex flex-col gap-1">
        <span className="text-base font-bold text-text-primary">{row.commodity.name}</span>
        <span className="font-mono text-2xl font-semibold tracking-tight text-text-primary">
          {formatRupiah(row.price)}
        </span>
        <span className="text-sm text-text-muted">per kg</span>
      </span>
      <span className="flex items-center justify-between gap-2">
        <ChangeTag ratio={row.change7} />
        <Sparkline points={row.history.slice(-30)} className="h-8 w-24" />
      </span>
      <span className="text-xs text-text-muted">Perubahan 7 hari</span>
    </Link>
  );
}
