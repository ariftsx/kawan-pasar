import type { Metadata } from 'next';
import Link from 'next/link';
import type { ReactNode } from 'react';
import { Kapa } from '@/brand/Kapa';
import { KapaMotion } from '@/brand/KapaMotion';
import { Button } from '@/components/atoms/Button';
import { Chip } from '@/components/atoms/Chip';
import { SectionHeader } from '@/components/molecules/SectionHeader';
import { LearnTeaser } from '@/components/organisms/LearnTeaser';
import { PageContainer } from '@/components/templates/SiteShell';
import { requireData } from '@/lib/api/client';
import { api } from '@/lib/api/endpoints';
import { hrefs } from '@/lib/hrefs';
import { marketFrom } from '@/lib/page-params';
import { pageMetadata } from '@/lib/seo';

export const revalidate = 21_600;
export const dynamicParams = true;
export function generateStaticParams(): { market: string }[] {
  return [];
}

export const metadata: Metadata = pageMetadata({
  title: 'Edukasi',
  description: 'Belajar inflasi pangan, cara membaca harga dan prediksi, dalam bahasa sederhana.',
  path: '/edukasi',
});

/** v0.4 "Pahami harga, bukan sekadar angka". Only published articles are listed. */
export default async function Edukasi({
  params,
}: {
  params: Promise<{ market: string }>;
}): Promise<ReactNode> {
  await marketFrom(params);
  const { items } = requireData(await api.articles());
  const first = items[0];
  const minutes = items.reduce((s, a) => s + a.readingMinutes, 0);

  return (
    <PageContainer className="flex flex-col gap-10 py-6 lg:py-10">
      <section className="flex flex-col items-center gap-6 rounded-2xl bg-kunyit-100 p-6 sm:flex-row sm:p-10">
        <div className="flex min-w-0 flex-1 flex-col items-start gap-3">
          <p className="text-overline-11 text-ink-2 uppercase">Edukasi · literasi inflasi</p>
          <h1 className="text-heading-h2-32 lg:text-heading-h1-40 text-balance">
            Pahami harga, bukan sekadar angka.
          </h1>
          <p className="text-body-medium-15 max-w-2xl text-ink-2">
            Belajar inflasi pangan, cara membaca harga dan prediksi, serta cara kerja ARIF-Net,
            dengan contoh langsung dari data Kawan Pasar.
          </p>
          <div className="flex flex-wrap items-center gap-3">
            {first === undefined ? null : (
              <Button href={hrefs.article(first.slug)} arrow>
                Mulai dari topik pertama
              </Button>
            )}
            <Chip tone="neutral" size="S">
              {items.length} topik · ±{minutes} menit
            </Chip>
          </div>
        </div>
        <KapaMotion>
          <Kapa pose="belajar" size={140} />
        </KapaMotion>
      </section>

      <section aria-labelledby="jalur-title" className="flex flex-col gap-4">
        <SectionHeader
          id="jalur-title"
          title="Jalur belajar"
          description="Ikuti berurutan, atau mulai dari topik yang Anda perlukan."
        />
        <ol className="grid gap-3 sm:grid-cols-[repeat(2,minmax(0,1fr))] lg:grid-cols-[repeat(3,minmax(0,1fr))]">
          {items.map((a, i) => (
            <li key={a.slug}>
              <Link
                href={hrefs.article(a.slug)}
                className="flex min-h-20 flex-col gap-1 rounded-lg border border-line bg-surface p-4 hover:border-green-900"
              >
                <span className="font-mono text-[12px] font-semibold text-green-700">
                  {String(i + 1).padStart(2, '0')}
                </span>
                <span className="text-sm font-bold">{a.title}</span>
              </Link>
            </li>
          ))}
        </ol>
      </section>

      <section aria-labelledby="topik-title" className="flex flex-col gap-4">
        <SectionHeader
          id="topik-title"
          title="Topik"
          description="Setiap topik terhubung ke data dan grafik terkait di Kawan Pasar."
        />
        <LearnTeaser articles={items} />
      </section>

      <div className="grid gap-4 md:grid-cols-[repeat(2,minmax(0,1fr))]">
        <section className="rounded-xl bg-green-100 p-5">
          <h2 className="text-heading-card-16">Tahukah Anda?</h2>
          <p className="mt-1 text-body-small-13 text-ink-2">
            Cabai dan bawang merah termasuk kelompok harga bergejolak (volatile food) yang dicatat
            BPS dalam rilis inflasi bulanan.
          </p>
        </section>
        <section className="rounded-xl bg-terong-100 p-5">
          <h2 className="text-heading-card-16">Dari edukasi ke produk</h2>
          <p className="mt-1 text-body-small-13 text-ink-2">
            Setiap grafik di Kawan Pasar bisa dibaca bersama ringkasan teks dan tabel datanya.
          </p>
        </section>
      </div>
    </PageContainer>
  );
}
