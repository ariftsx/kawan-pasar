import type { CommoditySummary } from '@kawan-pasar/contracts';
import type { ReactNode } from 'react';
import { CommodityIcon } from '@/brand/CommodityIcon';
import { FeatureIcon } from '@/brand/FeatureIcon';
import type { WeeklyHighlights } from '@/lib/insights/highlights';
import { formatRupiah } from '@/lib/format';
import { Delta } from '../atoms/Delta';
import { IconBox } from '../atoms/IconBox';
import { Price } from '../atoms/Price';
import { commodityTone } from '../molecules/commodity-display';
import { StatCard } from '../molecules/StatCard';

function MoverCard({
  overline,
  item,
  emptyText,
}: {
  overline: string;
  item: CommoditySummary | null;
  emptyText: string;
}): ReactNode {
  const latest = item?.latest ?? null;
  if (item === null || latest === null || item.change7d === null) {
    return (
      <StatCard
        icon={
          <IconBox tone="surface">
            <FeatureIcon name="harga" size={28} />
          </IconBox>
        }
        overline={overline}
        name={emptyText}
        value={<span className="text-heading-title-20 text-ink-2">—</span>}
        note="Perubahan dihitung dari harga 7 hari sebelumnya."
      />
    );
  }
  const before = Math.round(latest.priceIdr / (1 + item.change7d));
  const diff = latest.priceIdr - before;
  return (
    <StatCard
      icon={
        <IconBox tone={commodityTone(item.code)}>
          <CommodityIcon code={item.code} size={38} />
        </IconBox>
      }
      overline={overline}
      name={item.name}
      value={<Price value={latest.priceIdr} size="m" />}
      delta={<Delta value={item.change7d} />}
      note={`Per kg · ${diff >= 0 ? 'naik' : 'turun'} ${formatRupiah(Math.abs(diff))} dibanding 7 hari lalu.`}
    />
  );
}

/** Three highlight cards of the home page (v0.4): biggest rise, biggest fall, forecast mix. */
export function HighlightCards({ highlights }: { highlights: WeeklyHighlights }): ReactNode {
  const f = highlights.forecast;
  const parts =
    f === null
      ? []
      : [
          f.up > 0 ? `${String(f.up)} naik` : null,
          f.down > 0 ? `${String(f.down)} turun` : null,
          f.flat > 0 ? `${String(f.flat)} stabil` : null,
        ].filter((p): p is string => p !== null);
  return (
    <div className="grid gap-4 md:grid-cols-[repeat(3,minmax(0,1fr))]">
      <MoverCard
        overline="Paling naik minggu ini"
        item={highlights.topRise}
        emptyText="Tidak ada yang naik minggu ini"
      />
      <MoverCard
        overline="Paling turun minggu ini"
        item={highlights.topFall}
        emptyText="Tidak ada yang turun minggu ini"
      />
      <StatCard
        icon={
          <IconBox tone="terong">
            <FeatureIcon name="prediksi" size={28} />
          </IconBox>
        }
        overline={f?.expired === true ? 'Prediksi 7 hari · Kedaluwarsa' : 'Prediksi 7 hari'}
        name={
          f === null
            ? 'Prediksi belum tersedia'
            : `${String(f.up + f.down + f.flat)} komoditas diprediksi`
        }
        value={
          <span className="font-mono text-numeric-m-24 font-semibold">
            {parts.length === 0 ? '—' : parts.join(' · ')}
          </span>
        }
        note={
          f?.expired === true
            ? 'Kedaluwarsa: prediksi ini lebih dari 8 hari; tunggu prediksi baru. Estimasi, bukan jaminan harga.'
            : 'Arah perkiraan median 7 hari ke depan; estimasi, bukan jaminan harga.'
        }
      />
    </div>
  );
}
