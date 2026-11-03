import { DemoBadge } from '@kawan-pasar/ui';
import Link from 'next/link';

import {
  ChangeTag,
  FOCUS,
  KataKapa,
  PageHeader,
  SegmentedLinks,
  StatusChip,
  Surface,
  TextLink,
} from '@/components/kp/blocks';
import { PriceChart, Sparkline } from '@/components/kp/charts';
import { CommodityTile } from '@/components/kp/commodity';
import { formatChangeArrow, formatMarketDate, formatRupiah } from '@/lib/format';
import { byLargestMove, lastDays } from '@/lib/market/board';
import { param, withQuery } from '@/lib/market/route';
import { currentBoard, forecastOutlooks } from '@/lib/market/server';
import { visiblePoint } from '@/lib/outlook/schema';

import type { Metadata, Route } from 'next';

export const metadata: Metadata = { title: 'Harga Komoditas' };

const PERIODS = [
  { days: 30, label: '30H' },
  { days: 90, label: '90H' },
  { days: 365, label: '1T' },
] as const;

export default async function HargaPage({
  searchParams,
}: {
  readonly searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const query = await searchParams;
  const onlyForecast = param(query.tampil) === 'prediksi';
  const days = PERIODS.find((p) => String(p.days) === param(query.periode))?.days ?? 90;
  const board = currentBoard();
  const outlooks = await forecastOutlooks();
  const rows = byLargestMove(board.rows).filter(
    (row) => !onlyForecast || row.commodity.forecast === 'available',
  );
  const selected =
    board.rows.find((row) => row.commodity.slug === param(query.komoditas)) ?? board.rows[0];
  const base = { ...(onlyForecast ? { tampil: 'prediksi' } : {}) };
  return (
    <div className="flex flex-col gap-8">
      <PageHeader
        overline="Harga komoditas"
        title="Harga pangan hari ini"
        description={
          board.status === 'demo' ? (
            <>
              Harga observasi Pasar Kramat Jati dari PIHPS, terakhir {formatMarketDate(board.asOf)}.
              Bukan harga real-time. <DemoBadge />
            </>
          ) : (
            'Harga harian PIHPS Pasar Kramat Jati belum tersedia. Pengambilan data sedang disiapkan.'
          )
        }
      />

      <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <SegmentedLinks
          label="Saring komoditas"
          items={[
            { href: '/harga', label: 'Semua komoditas (5)', isActive: !onlyForecast },
            {
              href: withQuery('/harga', { tampil: 'prediksi' }),
              label: 'Bisa diprediksi (3)',
              isActive: onlyForecast,
            },
          ]}
        />
        <p className="text-sm text-text-muted">Diurutkan: perubahan 7 hari terbesar</p>
      </div>

      <ul className="flex flex-col gap-3 md:hidden" aria-label="Daftar harga komoditas">
        {rows.map((row) => {
          const outlook = outlooks.get(row.commodity.slug);
          const point = outlook?.kind === 'ready' ? visiblePoint(outlook.points, 7) : null;
          return (
            <li key={row.commodity.slug}>
              <Link
                href={`/harga/${row.commodity.slug}` as Route}
                className={`flex flex-col gap-3 rounded-3xl border border-border-default bg-bg-surface p-4 ${FOCUS}`}
              >
                <span className="flex items-center gap-3">
                  <CommodityTile slug={row.commodity.slug} className="size-11" />
                  <span className="flex flex-1 flex-col">
                    <span className="text-base font-bold">{row.commodity.name}</span>
                    <span className="text-sm text-text-muted">per kg</span>
                  </span>
                  <span className="font-mono text-lg font-semibold">{formatRupiah(row.price)}</span>
                </span>
                <span className="flex flex-wrap items-center gap-2">
                  <ChangeTag ratio={row.change7} />
                  <span className="text-sm text-text-muted">7 hari</span>
                  <span className="ml-auto">
                    {row.commodity.forecast === 'coming_soon' ? (
                      <StatusChip tone="neutral">Prediksi menyusul</StatusChip>
                    ) : point === null ? (
                      <StatusChip tone="outline">Prediksi gagal dimuat</StatusChip>
                    ) : (
                      <StatusChip tone="forecast">
                        ★ 7 hari {formatChangeArrow(point.predicted_change)}
                      </StatusChip>
                    )}
                  </span>
                </span>
              </Link>
            </li>
          );
        })}
      </ul>

      <Surface className="hidden p-0 md:block">
        <div
          className="overflow-x-auto rounded-3xl"
          tabIndex={0}
          role="region"
          aria-label="Tabel harga, geser ke samping"
        >
          <table className="w-full min-w-3xl text-left">
            <caption className="sr-only">
              Harga komoditas Pasar Kramat Jati, perubahan 7 dan 30 hari, dan prediksi 7 hari
            </caption>
            <thead className="bg-bg-subtle text-xs font-bold tracking-wider text-text-muted uppercase">
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
                  Prediksi 7 hari ★
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border-default">
              {rows.map((row) => {
                const outlook = outlooks.get(row.commodity.slug);
                const point = outlook?.kind === 'ready' ? visiblePoint(outlook.points, 7) : null;
                return (
                  <tr key={row.commodity.slug}>
                    <th scope="row" className="px-5 py-4 font-normal">
                      <Link
                        href={`/harga/${row.commodity.slug}` as Route}
                        className={`flex items-center gap-3 rounded-md ${FOCUS}`}
                      >
                        <CommodityTile slug={row.commodity.slug} className="size-11" />
                        <span className="flex flex-col">
                          <span className="text-base font-bold text-text-primary underline-offset-4 hover:underline">
                            {row.commodity.name}
                          </span>
                          <span className="text-sm text-text-muted">Kramat Jati · per kg</span>
                        </span>
                      </Link>
                    </th>
                    <td className="px-3 py-4">
                      <Sparkline points={row.history.slice(-30)} />
                    </td>
                    <td className="px-3 py-4 text-right font-mono text-lg font-semibold">
                      {formatRupiah(row.price)}
                    </td>
                    <td className="px-3 py-4">
                      <ChangeTag ratio={row.change7} />
                    </td>
                    <td className="px-3 py-4">
                      <ChangeTag ratio={row.change30} />
                    </td>
                    <td className="px-5 py-4">
                      {row.commodity.forecast === 'coming_soon' ? (
                        <StatusChip tone="neutral">Prediksi menyusul</StatusChip>
                      ) : point === null ? (
                        <StatusChip tone="outline">Gagal memuat</StatusChip>
                      ) : (
                        <StatusChip tone="forecast">
                          ★ {formatChangeArrow(point.predicted_change)}
                        </StatusChip>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </Surface>

      {selected === undefined ? null : (
        <section className="grid grid-cols-1 gap-5 lg:grid-cols-3">
          <Surface className="flex flex-col gap-4 lg:col-span-2" aria-labelledby="riwayat-title">
            <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
              <div>
                <h2 id="riwayat-title" className="text-xl font-extrabold">
                  Riwayat harga · {selected.commodity.name}
                </h2>
                <p className="text-sm text-text-secondary">
                  Kramat Jati · Rp/kg · {days === 365 ? '1 tahun' : `${String(days)} hari`} ·
                  observasi aktual
                </p>
              </div>
              <SegmentedLinks
                label="Periode riwayat"
                items={PERIODS.map((p) => ({
                  href: withQuery('/harga', {
                    ...base,
                    komoditas: selected.commodity.slug,
                    periode: String(p.days),
                  }),
                  label: p.label,
                  isActive: p.days === days,
                }))}
              />
            </div>
            <PriceChart
              title={`Riwayat harga ${selected.commodity.name}`}
              observed={lastDays(selected.history, days)}
            />
            <div className="flex flex-wrap items-center justify-between gap-2">
              <p className="text-sm text-text-muted">Sumber: PIHPS · Pasar Kramat Jati</p>
              <TextLink href={`/harga/${selected.commodity.slug}` as Route}>
                Detail komoditas ini
              </TextLink>
            </div>
          </Surface>
          <KataKapa
            pose="waspada"
            title={`${selected.commodity.name}: ${formatChangeArrow(selected.change30)} dalam 30 hari.`}
            link={{ href: '/peringatan', label: 'Atur peringatan' }}
          >
            Peringatan memberi tahu Anda saat harga bergerak lebih tajam dari kebiasaannya.
          </KataKapa>
        </section>
      )}
    </div>
  );
}
