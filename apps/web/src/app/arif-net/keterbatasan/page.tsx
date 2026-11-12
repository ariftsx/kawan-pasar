import type { Metadata } from 'next';
import type { ReactNode } from 'react';
import { FeatureIcon } from '@/brand/FeatureIcon';
import type { FeatureIconName } from '@/brand/FeatureIcon';
import { Kapa } from '@/brand/Kapa';
import { KapaMotion } from '@/brand/KapaMotion';
import { Chip } from '@/components/atoms/Chip';
import { IconBox } from '@/components/atoms/IconBox';
import { SectionHeader } from '@/components/molecules/SectionHeader';
import { PageContainer } from '@/components/templates/SiteShell';
import { LIMITS, OPEN_DECISIONS } from '@/content/arif-net';
import { pageMetadata } from '@/lib/seo';

export const metadata: Metadata = pageMetadata({
  title: 'Keterbatasan ARIF-Net',
  description: 'Batas data, model, cara membaca hasil, dan produk Kawan Pasar.',
  path: '/arif-net/keterbatasan',
});

const ICON: Record<string, FeatureIconName> = {
  Data: 'harga',
  Model: 'arif-net',
  'Cara membaca': 'info',
  Produk: 'beranda',
};

/** v0.4 "Jujur soal batasannya". Static (no API). */
export default function Keterbatasan(): ReactNode {
  return (
    <PageContainer className="flex flex-col gap-10 py-6 lg:py-10">
      <header className="flex flex-col gap-6 sm:flex-row sm:items-center">
        <div className="flex min-w-0 flex-1 flex-col gap-2">
          <p className="text-overline-11 text-terong-600 uppercase">ARIF-Net / Keterbatasan</p>
          <h1 className="text-heading-h2-32 lg:text-heading-h1-40">Jujur soal batasannya</h1>
          <p className="text-body-medium-15 max-w-2xl text-ink-2">
            Setiap model punya batasan. Bagian ini merangkum batasan data, model, cara membaca
            hasil, dan produk, serta keputusan yang masih terbuka.
          </p>
        </div>
        <KapaMotion>
          <Kapa pose="istirahat" size={110} />
        </KapaMotion>
      </header>

      <ul className="grid gap-4 md:grid-cols-[repeat(2,minmax(0,1fr))]">
        {LIMITS.map((l) => (
          <li key={l.title} className="rounded-xl border border-line bg-surface p-5 sm:p-6">
            <h2 className="flex items-center gap-3 text-heading-card-16">
              <IconBox tone="kunyit" size={40}>
                <FeatureIcon name={ICON[l.title] ?? 'info'} />
              </IconBox>
              {l.title}
            </h2>
            <ul className="mt-3 list-disc space-y-1.5 pl-5 text-body-small-13 text-ink-2 marker:text-kunyit-500">
              {l.items.map((i) => (
                <li key={i}>{i}</li>
              ))}
            </ul>
          </li>
        ))}
      </ul>

      <section aria-labelledby="terbuka-title" className="flex flex-col gap-4">
        <SectionHeader
          id="terbuka-title"
          title="Keputusan yang masih terbuka"
          description="Dicatat agar tidak diputuskan diam-diam oleh tampilan atau kode."
        />
        <div
          tabIndex={0}
          role="region"
          aria-label="Tabel keputusan terbuka (bisa digeser)"
          className="relative overflow-x-auto rounded-xl border border-line bg-surface"
        >
          <table className="w-full min-w-[32rem] text-left text-sm">
            <caption className="sr-only">Keputusan yang masih terbuka</caption>
            <thead className="bg-surface-2 text-overline-11 text-muted-text uppercase">
              <tr>
                <th scope="col" className="px-5 py-3">
                  Keputusan
                </th>
                <th scope="col" className="px-3 py-3">
                  Status
                </th>
                <th scope="col" className="px-5 py-3">
                  Dampak ke produk
                </th>
              </tr>
            </thead>
            <tbody>
              {OPEN_DECISIONS.map((d) => (
                <tr key={d.decision} className="border-t border-line">
                  <th scope="row" className="px-5 py-3 font-semibold">
                    {d.decision}
                  </th>
                  <td className="px-3 py-3">
                    <Chip tone={d.status === 'Riset berjalan' ? 'kunyit' : 'neutral'} size="S">
                      {d.status}
                    </Chip>
                  </td>
                  <td className="px-5 py-3 text-ink-2">{d.impact}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </PageContainer>
  );
}
