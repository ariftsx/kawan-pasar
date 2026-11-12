import type { ReactNode } from 'react';
import { Illustration } from '@/brand/Illustration';
import { Chip } from '../atoms/Chip';

/** Data coverage card (v0.4 Beranda): one market now, more later. */
export function CoverageCard({
  marketName,
  coveredCount,
}: {
  marketName: string;
  coveredCount: number;
}): ReactNode {
  return (
    <section
      aria-labelledby="cakupan-title"
      className="grid overflow-hidden rounded-xl border border-line bg-surface md:grid-cols-[minmax(0,2fr)_minmax(0,3fr)]"
    >
      <div className="flex items-center justify-center bg-green-100 p-4">
        <Illustration name="peta" className="max-h-56" />
      </div>
      <div className="flex min-w-0 flex-col gap-3 p-5 sm:p-8">
        <Chip tone="chili" size="S" className="self-start">
          Cakupan data
        </Chip>
        <h2 id="cakupan-title" className="text-heading-title-20 sm:text-heading-h3-24 text-balance">
          Sekarang di {marketName}. Segera ke pasar dan wilayah lain.
        </h2>
        <p className="text-body-small-13 sm:text-body-medium-15 text-ink-2">
          Harga tiap daerah berbeda. Tahap awal memakai data {marketName} dengan {coveredCount}{' '}
          komoditas yang bisa diprediksi. Pasar/wilayah lain serta cabai rawit hijau dan cabai rawit
          merah sedang dikembangkan.
        </p>
        <ul className="flex flex-wrap gap-2">
          <li>
            <Chip tone="green" size="S">
              ● {marketName} · tersedia
            </Chip>
          </li>
          <li>
            <Chip tone="outline" size="S">
              Pasar/wilayah lain · segera
            </Chip>
          </li>
          <li>
            <Chip tone="outline" size="S">
              Cabai rawit hijau & merah · segera
            </Chip>
          </li>
        </ul>
      </div>
    </section>
  );
}
