import { listMarkets } from '@kawan-pasar/catalog';

import { Illustration } from '@/components/brand/illustration';
import { PageHeader, StatusChip } from '@/components/kp/blocks';

import type { Metadata } from 'next';

export const metadata: Metadata = { title: 'Pilih Pasar' };

export default function PasarPage() {
  const markets = listMarkets();
  return (
    <div className="flex flex-col gap-8">
      <PageHeader
        overline="Pasar"
        title="Pilih pasar acuan"
        description="Saat ini Kawan Pasar memakai Pasar Kramat Jati, Jakarta Timur, sebagai pasar acuan."
        aside={<Illustration name="peta" className="hidden w-52 md:block" />}
      />
      <ul className="flex flex-col gap-3" aria-label="Daftar pasar">
        {markets.map((market) => {
          const isOn = market.status === 'available';
          return (
            <li
              key={market.slug}
              aria-current={isOn ? 'true' : undefined}
              className={`flex min-h-16 items-center justify-between gap-4 rounded-3xl border bg-bg-surface p-5 ${isOn ? 'border-border-brand' : 'border-border-default'}`}
            >
              <span className="flex flex-col">
                <span className="text-lg font-bold">{market.name}</span>
                <span className="text-base text-text-secondary">{market.region}</span>
              </span>
              {isOn ? (
                <StatusChip tone="brand">✓ Dipakai</StatusChip>
              ) : (
                <StatusChip tone="neutral">Segera hadir</StatusChip>
              )}
            </li>
          );
        })}
      </ul>
    </div>
  );
}
