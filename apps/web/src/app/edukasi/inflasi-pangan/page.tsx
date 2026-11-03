import { Illustration } from '@/components/brand/illustration';
import { KataKapa, Overline, Surface, TextLink } from '@/components/kp/blocks';

import type { Metadata } from 'next';

export const metadata: Metadata = { title: 'Apa itu inflasi pangan?' };

const SOURCES = [
  {
    href: 'https://www.bps.go.id/id/subject/3/inflasi.html',
    label: 'Badan Pusat Statistik — Inflasi',
  },
  {
    href: 'https://www.bi.go.id/id/fungsi-utama/moneter/inflasi/default.aspx',
    label: 'Bank Indonesia — Inflasi',
  },
  {
    href: 'https://www.bi.go.id/hargapangan',
    label: 'PIHPS Nasional — Pusat Informasi Harga Pangan Strategis',
  },
] as const;

export default function InflasiPanganPage() {
  return (
    <article className="mx-auto flex max-w-3xl flex-col gap-8">
      <header className="flex flex-col gap-3">
        <Overline className="text-text-brand">Edukasi · 4 menit baca</Overline>
        <h1 className="text-3xl font-extrabold tracking-tight md:text-4xl">
          Apa itu inflasi pangan?
        </h1>
        <p className="text-lg text-text-secondary">
          Inflasi adalah kenaikan harga barang dan jasa secara umum dan terus-menerus. Inflasi
          pangan adalah bagian yang berasal dari bahan makanan.
        </p>
      </header>
      <Illustration name="inflasi" className="w-full max-w-md self-center" />
      <section className="flex flex-col gap-3 text-lg leading-relaxed">
        <h2 className="text-2xl font-extrabold">Bagaimana angkanya dihitung</h2>
        <p>
          Badan Pusat Statistik (BPS) mengukur inflasi melalui Indeks Harga Konsumen (IHK), yaitu
          harga sekeranjang barang dan jasa yang biasa dibeli rumah tangga. Bahan makanan seperti
          beras, cabai, dan bawang merah termasuk di dalam keranjang tersebut.
        </p>
        <h2 className="mt-4 text-2xl font-extrabold">Mengapa cabai dan bawang sering disebut</h2>
        <p>
          Bank Indonesia memisahkan komponen harga bergejolak (<i>volatile food</i>), yaitu bahan
          pangan yang harganya mudah naik-turun karena panen, cuaca, dan distribusi. Cabai dan
          bawang merah termasuk komoditas yang sering bergerak tajam, sehingga perubahannya cepat
          terasa di pasar.
        </p>
        <h2 className="mt-4 text-2xl font-extrabold">Apa hubungannya dengan Kawan Pasar</h2>
        <p>
          Kawan Pasar menampilkan harga harian dari PIHPS untuk Pasar Kramat Jati dan perkiraan
          ARIF-Net. Angka di sini membantu melihat arah pergerakan, tetapi tidak menggantikan angka
          inflasi resmi dari BPS.
        </p>
      </section>
      <KataKapa pose="belajar" title="Satu pasar bukan gambaran nasional.">
        Harga di Pasar Kramat Jati bisa berbeda dengan pasar lain. Untuk angka resmi, lihat rilis
        BPS.
      </KataKapa>
      <Surface className="flex flex-col gap-3" aria-labelledby="sumber-title">
        <h2 id="sumber-title" className="text-lg font-bold">
          Sumber
        </h2>
        <ul className="flex flex-col gap-2">
          {SOURCES.map((source) => (
            <li key={source.href}>
              <a
                href={source.href}
                className="inline-flex min-h-11 items-center font-semibold text-text-brand underline underline-offset-4"
                rel="noreferrer"
                target="_blank"
              >
                {source.label}
              </a>
            </li>
          ))}
        </ul>
      </Surface>
      <TextLink href="/edukasi">Kembali ke Edukasi</TextLink>
    </article>
  );
}
