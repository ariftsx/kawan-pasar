import type { Metadata } from 'next';
import type { ReactNode } from 'react';
import { CommodityIcon } from '@/brand/CommodityIcon';
import { FeatureIcon } from '@/brand/FeatureIcon';
import type { FeatureIconName } from '@/brand/FeatureIcon';
import { Kapa } from '@/brand/Kapa';
import { KapaMotion } from '@/brand/KapaMotion';
import { Button } from '@/components/atoms/Button';
import { Chip } from '@/components/atoms/Chip';
import type { IconBoxTone } from '@/components/atoms/IconBox';
import { IconBox } from '@/components/atoms/IconBox';
import { PageContainer } from '@/components/templates/SiteShell';
import { pageMetadata } from '@/lib/seo';

export const metadata: Metadata = pageMetadata({
  title: 'Kawan Pasar — cek harga pangan sebelum belanja',
  description:
    'Pantau harga harian komoditas pokok di Pasar Kramat Jati dan perkiraannya hingga 1 tahun. Gratis, tanpa daftar akun.',
  path: '/',
});

const STEPS: readonly { icon: FeatureIconName; tone: IconBoxTone; title: string; body: string }[] =
  [
    {
      icon: 'pasar',
      tone: 'chili',
      title: '1. Pilih pasar & komoditas',
      body: 'Mulai dari Pasar Kramat Jati: cabai, bawang merah, beras.',
    },
    {
      icon: 'harga',
      tone: 'kunyit',
      title: '2. Lihat harga hari ini',
      body: 'Harga harian dari PIHPS, lengkap dengan tren.',
    },
    {
      icon: 'prediksi',
      tone: 'terong',
      title: '3. Cek prediksinya',
      body: '1 hari sampai 1 tahun ke depan, sebagai gambaran belanja.',
    },
  ];

/**
 * First-visit orientation (v0.4 "Beranda Publik"). Static: no data, so the example below is an
 * illustration and labelled as such. Returning visitors are sent to /beranda by proxy.ts.
 */
export default function Orientasi(): ReactNode {
  return (
    <PageContainer className="flex flex-col gap-10 py-6 lg:py-10">
      <section className="flex flex-col items-center gap-6 overflow-hidden rounded-2xl bg-green-900 p-6 text-surface sm:flex-row-reverse sm:p-10 lg:p-14">
        <div className="flex shrink-0 flex-col items-center gap-2">
          <p className="max-w-56 rounded-lg bg-surface px-4 py-3 text-body-small-13 text-ink shadow-[0_8px_24px_#0000001f]">
            <strong>Halo, aku Kapa!</strong> Aku bantu pantau harga pangan sebelum kamu ke pasar.
          </p>
          <KapaMotion>
            <Kapa pose="halo" size={150} />
          </KapaMotion>
        </div>
        <div className="flex min-w-0 flex-1 flex-col items-start gap-4">
          <h1 className="text-heading-h2-32 lg:text-display-56 text-balance">
            Berapa harga cabai hari ini, dan minggu depan?
          </h1>
          <p className="text-body-medium-15 lg:text-body-large-17 max-w-xl text-surface/85">
            Pantau harga 5 komoditas pokok dan prediksinya hingga 1 tahun. Gratis, tanpa daftar
            akun.
          </p>
          <Button href="/beranda" variant="primary" size="L" arrow>
            Lihat harga hari ini
          </Button>
        </div>
      </section>

      <section aria-labelledby="langkah-title" className="flex flex-col gap-4">
        <h2 id="langkah-title" className="text-heading-h3-24">
          Caranya cukup 3 langkah
        </h2>
        <ol className="grid gap-3 md:grid-cols-[repeat(3,minmax(0,1fr))]">
          {STEPS.map((s) => (
            <li
              key={s.title}
              className="flex items-start gap-3 rounded-xl border border-line bg-surface p-5"
            >
              <IconBox tone={s.tone} size={40}>
                <FeatureIcon name={s.icon} />
              </IconBox>
              <div className="min-w-0">
                <h3 className="text-heading-card-16">{s.title}</h3>
                <p className="text-body-small-13 text-ink-2">{s.body}</p>
              </div>
            </li>
          ))}
        </ol>
      </section>

      <div className="grid gap-4 md:grid-cols-[repeat(2,minmax(0,1fr))]">
        <section
          aria-labelledby="contoh-title"
          className="flex flex-col gap-3 rounded-xl bg-terong-100 p-5"
        >
          <h2 id="contoh-title" className="text-overline-11 text-terong-600 uppercase">
            Contoh tampilan prediksi
          </h2>
          <div className="flex items-center gap-3 rounded-lg bg-surface p-4">
            <IconBox tone="chili" size={40}>
              <CommodityIcon code="cabai-merah-keriting" size={30} />
            </IconBox>
            <div className="min-w-0 flex-1">
              <p className="text-sm font-bold">Cabai merah keriting</p>
              <Chip tone="terong" size="S">
                ★ perkiraan 7 hari
              </Chip>
            </div>
            <Chip tone="outline" size="S">
              Ilustrasi
            </Chip>
          </div>
          <p className="text-body-small-13 text-ink-2">
            Setiap prediksi disertai rentang kemungkinan, versi model, dan tanggal data. Angka
            sebenarnya ada di halaman Beranda dan Prediksi.
          </p>
        </section>
        <section
          aria-labelledby="sumber-title"
          className="flex flex-col gap-2 rounded-xl border border-line bg-surface p-5"
        >
          <h2 id="sumber-title" className="text-heading-card-16">
            Dari mana harganya?
          </h2>
          <p className="text-body-small-13 text-ink-2">
            Harga harian dari PIHPS untuk Pasar Kramat Jati. Pasar/wilayah lain serta prediksi cabai
            rawit hijau & merah menyusul. Prediksi adalah estimasi model, bukan jaminan harga dan
            bukan rekomendasi jual/beli.
          </p>
        </section>
      </div>
    </PageContainer>
  );
}
