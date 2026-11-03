import { DemoBadge } from '@kawan-pasar/ui';

import { FeatureIcon } from '@/components/brand/feature-icon';
import { FOCUS, PageHeader, StatusChip, Surface } from '@/components/kp/blocks';
import { formatChangeArrow, formatMarketDate, formatRupiah } from '@/lib/format';
import { changeOver } from '@/lib/market/board';
import { currentBoard, forecastOutlooks } from '@/lib/market/server';
import { visiblePoint } from '@/lib/outlook/schema';

import type { Metadata } from 'next';

export const metadata: Metadata = { title: 'Mode Analis' };

export default async function AnalisPage() {
  const board = currentBoard();
  const outlooks = await forecastOutlooks();
  return (
    <div className="flex flex-col gap-8">
      <PageHeader
        overline="Mode Analis"
        title="Tabel sinyal harga"
        description={
          board.status === 'demo' ? (
            <>
              Ringkasan angka per komoditas, {formatMarketDate(board.asOf)}. <DemoBadge />
            </>
          ) : (
            'Harga harian belum tersedia, sehingga tabel masih kosong.'
          )
        }
        aside={
          <a
            href="/analis/unduh"
            download
            className={`inline-flex min-h-11 items-center gap-2 rounded-full bg-accent-brand-strong px-5 font-semibold text-accent-on-brand-strong ${FOCUS}`}
          >
            <FeatureIcon name="unduh" className="size-5" />
            Unduh CSV
          </a>
        }
      />
      <Surface className="p-0">
        <div
          className="overflow-x-auto rounded-3xl"
          tabIndex={0}
          role="region"
          aria-label="Tabel sinyal harga, geser ke samping"
        >
          <table className="w-full min-w-3xl text-left text-base">
            <caption className="sr-only">Sinyal harga per komoditas</caption>
            <thead className="bg-bg-subtle text-sm text-text-muted">
              <tr>
                {[
                  'Komoditas',
                  'Harga',
                  '1 hari',
                  '7 hari',
                  '30 hari',
                  '90 hari',
                  'Prediksi 7 hari',
                  'Status model',
                ].map((label) => (
                  <th key={label} scope="col" className="px-4 py-3 font-semibold">
                    {label}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-border-default font-mono">
              {board.rows.map((row) => {
                const outlook = outlooks.get(row.commodity.slug);
                const point = outlook?.kind === 'ready' ? visiblePoint(outlook.points, 7) : null;
                return (
                  <tr key={row.commodity.slug}>
                    <th scope="row" className="px-4 py-3 font-sans font-semibold">
                      {row.commodity.name}
                    </th>
                    <td className="px-4 py-3">{formatRupiah(row.price)}</td>
                    {[1, 7, 30, 90].map((day) => (
                      <td key={day} className="px-4 py-3">
                        {formatChangeArrow(changeOver(row.history, day))}
                      </td>
                    ))}
                    <td className="px-4 py-3">
                      {point === null ? '—' : formatRupiah(point.predicted_price_idr)}
                    </td>
                    <td className="px-4 py-3 font-sans">
                      {row.commodity.forecast !== 'available' ? (
                        <StatusChip tone="neutral">Menyusul</StatusChip>
                      ) : outlook?.kind === 'ready' ? (
                        <StatusChip tone="forecast">
                          {outlook.provenance.artifact_status}
                        </StatusChip>
                      ) : (
                        <StatusChip tone="chili">Gagal memuat</StatusChip>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </Surface>
      <p className="text-sm text-text-muted">
        Kolom CSV: tanggal, komoditas, pasar, harga_idr, sumber. Data demo ditandai “DATA DEMO” di
        kolom sumber.
      </p>
    </div>
  );
}
