import { getCommodity, isCommoditySlug } from '@kawan-pasar/catalog';
import { DemoBadge, MetricCard } from '@kawan-pasar/ui';
import Link from 'next/link';
import { notFound } from 'next/navigation';

import {
  ChangeTag,
  FOCUS,
  KataKapa,
  Overline,
  SegmentedLinks,
  StatusChip,
  Surface,
  TextLink,
} from '@/components/kp/blocks';
import { PriceChart } from '@/components/kp/charts';
import { CommodityTile } from '@/components/kp/commodity';
import { ContextGrid } from '@/components/kp/context';
import { formatChange, formatChangeArrow, formatMarketDate, formatRupiah } from '@/lib/format';
import { changeOver, lastDays, type BoardRow } from '@/lib/market/board';
import { param, withQuery } from '@/lib/market/route';
import { currentBoard } from '@/lib/market/server';
import { visiblePoint, type OutlookPoint } from '@/lib/outlook/schema';
import { getOutlook } from '@/lib/outlook/server';

import type { Metadata } from 'next';

type Props = {
  readonly params: Promise<{ slug: string }>;
  readonly searchParams: Promise<Record<string, string | string[] | undefined>>;
};

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  return { title: getCommodity(slug)?.name ?? 'Komoditas' };
}

const PERIODS = [
  { days: 30, label: '30H' },
  { days: 90, label: '90H' },
  { days: 365, label: '1T' },
] as const;

function ForecastSide({
  row,
  point,
}: {
  readonly row: BoardRow;
  readonly point: OutlookPoint | null;
}) {
  const forecastable = row.commodity.forecast === 'available';
  const slug = row.commodity.slug;
  return (
    <>
      {forecastable ? (
        <Surface className="flex flex-col gap-2 bg-accent-forecast-bg">
          <Overline className="text-accent-forecast-fg">Prediksi 7 hari</Overline>
          {point === null ? (
            <p className="text-base text-text-secondary">
              Prediksi sedang tidak dapat dimuat. Coba lagi nanti.
            </p>
          ) : (
            <>
              <p className="font-mono text-3xl font-semibold">
                {formatRupiah(point.predicted_price_idr)}
              </p>
              <p className="text-sm text-text-secondary">
                Perkiraan {formatMarketDate(point.target_date)} ·{' '}
                {formatChangeArrow(point.predicted_change)} · estimasi, bukan jaminan
              </p>
            </>
          )}
          <TextLink href={withQuery('/prediksi', { komoditas: slug })}>Semua horizon</TextLink>
        </Surface>
      ) : (
        <Surface className="flex flex-col gap-2">
          <Overline>Prediksi</Overline>
          <p className="text-base font-bold">Prediksi {row.commodity.name} menyusul</p>
          <p className="text-sm text-text-secondary">
            Harga hari ini tetap bisa dipantau. Prediksi untuk komoditas ini dikembangkan pada tahap
            berikutnya.
          </p>
        </Surface>
      )}
    </>
  );
}

export default async function DetailKomoditasPage({ params, searchParams }: Props) {
  const { slug } = await params;
  if (!isCommoditySlug(slug)) notFound();
  const query = await searchParams;
  const days = PERIODS.find((p) => String(p.days) === param(query.periode))?.days ?? 90;
  const board = currentBoard();
  const row = board.rows.find((item) => item.commodity.slug === slug);
  if (row === undefined) notFound();
  const forecastable = row.commodity.forecast === 'available';
  const outlook = forecastable ? await getOutlook(slug) : null;
  const point = outlook?.kind === 'ready' ? visiblePoint(outlook.points, 7) : null;
  return (
    <div className="flex flex-col gap-8">
      <nav aria-label="Navigasi kembali" className="text-sm text-text-secondary">
        <Link
          href="/harga"
          className={`inline-flex min-h-11 items-center gap-1 rounded-md font-semibold text-text-brand ${FOCUS}`}
        >
          <span aria-hidden>←</span> Kembali ke Harga
        </Link>
      </nav>

      <Surface className="flex flex-col gap-5 md:flex-row md:items-center md:justify-between">
        <div className="flex items-center gap-4">
          <CommodityTile slug={row.commodity.slug} className="size-16" />
          <div className="flex flex-col gap-2">
            <h1 className="text-3xl font-extrabold tracking-tight md:text-4xl">
              {row.commodity.name}
            </h1>
            <p className="flex flex-wrap gap-2">
              <StatusChip tone="outline">Pasar Kramat Jati</StatusChip>
              <StatusChip tone="outline">per kg</StatusChip>
              {forecastable ? (
                <StatusChip tone="forecast">★ Bisa diprediksi</StatusChip>
              ) : (
                <StatusChip tone="neutral">Prediksi menyusul</StatusChip>
              )}
            </p>
            <p className="text-sm text-text-muted">
              {board.status === 'demo' ? (
                <>
                  Terakhir diperbarui {formatMarketDate(board.asOf)} · sumber PIHPS <DemoBadge />
                </>
              ) : (
                'Harga harian belum tersedia.'
              )}
            </p>
          </div>
        </div>
        <div className="flex flex-col items-start gap-2 md:items-end">
          <p className="font-mono text-4xl font-semibold tracking-tight">
            {formatRupiah(row.price)}
          </p>
          <ChangeTag ratio={row.change7} />
          <p className="text-sm text-text-muted">Perubahan 7 hari</p>
        </div>
      </Surface>

      <section aria-labelledby="ringkasan-title" className="flex flex-col gap-4">
        <h2 id="ringkasan-title" className="sr-only">
          Ringkasan perubahan
        </h2>
        <ul className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-4">
          {[1, 7, 30, 90].map((day) => (
            <li key={day}>
              <MetricCard
                label={`${String(day)} hari`}
                value={formatChange(changeOver(row.history, day))}
                caption={`perubahan ${String(day)} hari terakhir`}
              />
            </li>
          ))}
        </ul>
      </section>

      <section className="grid grid-cols-1 gap-5 lg:grid-cols-3">
        <Surface className="flex flex-col gap-4 lg:col-span-2" aria-labelledby="gerak-title">
          <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
            <h2 id="gerak-title" className="text-xl font-extrabold">
              Bagaimana harganya bergerak?
            </h2>
            <SegmentedLinks
              label="Periode grafik"
              items={PERIODS.map((p) => ({
                href: withQuery(`/harga/${slug}`, { periode: String(p.days) }),
                label: p.label,
                isActive: p.days === days,
              }))}
            />
          </div>
          <PriceChart
            title={`Harga ${row.commodity.name}`}
            observed={lastDays(row.history, days)}
            {...(point === null
              ? {}
              : {
                  forecast: {
                    points: [{ date: point.target_date, price: point.predicted_price_idr }],
                    focusDate: point.target_date,
                  },
                })}
          />
        </Surface>
        <div className="flex flex-col gap-5">
          <ForecastSide row={row} point={point} />
          <KataKapa
            pose="belajar"
            title="Garis putus-putus adalah perkiraan."
            link={{ href: '/edukasi', label: 'Cara membaca prediksi' }}
          >
            Garis tegas adalah harga yang benar-benar tercatat. Makin jauh horizonnya, makin besar
            ketidakpastiannya.
          </KataKapa>
        </div>
      </section>

      <section aria-labelledby="konteks-title" className="flex flex-col gap-4">
        <div>
          <h2 id="konteks-title" className="text-2xl font-extrabold">
            Konteks yang tersedia
          </h2>
          <p className="text-base text-text-secondary">
            Informasi yang dipakai ARIF-Net sebagai pertimbangan, bukan penyebab pasti perubahan
            harga.
          </p>
        </div>
        <ContextGrid availability={outlook?.kind === 'ready' ? outlook.availability : null} />
      </section>
    </div>
  );
}
