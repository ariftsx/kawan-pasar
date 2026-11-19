import type { Metadata } from 'next';
import type { ReactNode } from 'react';
import { FeatureIcon } from '@/brand/FeatureIcon';
import { Illustration } from '@/brand/Illustration';
import { Kapa } from '@/brand/Kapa';
import { KapaMotion } from '@/brand/KapaMotion';
import { Button } from '@/components/atoms/Button';
import { Chip } from '@/components/atoms/Chip';
import { SectionHeader } from '@/components/molecules/SectionHeader';
import { PageContainer } from '@/components/templates/SiteShell';
import {
  ACCURACY,
  ACCURACY_BY_HORIZON,
  ACCURACY_HORIZONS,
  PARTS,
  PIPELINE,
  PROSPECTIVE_OPENS,
} from '@/content/arif-net';
import { formatDateWib } from '@/lib/format';
import { pageMetadata } from '@/lib/seo';

export const metadata: Metadata = pageMetadata({
  title: 'Kenalan dengan ARIF-Net',
  description:
    'Model prediksi harga Kawan Pasar: masalah yang diselesaikan, cara kerja, hasil uji, dan keterbatasannya.',
  path: '/arif-net',
});

const fmt = (v: number): string =>
  v.toLocaleString('id-ID', { minimumFractionDigits: 3, maximumFractionDigits: 3 });

/** v0.4 "Kenalan dengan ARIF-Net". Static (no API). */
export default function ArifNet(): ReactNode {
  const maxBar = Math.max(...ACCURACY.map((r) => r.relMae));
  return (
    <PageContainer className="flex flex-col gap-12 py-6 lg:py-10">
      <section className="flex flex-col items-center gap-6 rounded-2xl bg-terong-600 p-6 text-surface sm:flex-row sm:p-10 lg:p-14">
        <div className="flex min-w-0 flex-1 flex-col items-start gap-4">
          <p className="flex flex-wrap gap-2">
            <Chip tone="dark" size="S">
              ARIF-Net A0 · v1.1.0
            </Chip>
            <Chip tone="kunyit-solid" size="S">
              Uji prospektif dibuka sesudah{' '}
              {formatDateWib(PROSPECTIVE_OPENS, 'short').replace(/^\w+, /, '')}
            </Chip>
          </p>
          <h1 className="text-heading-h2-32 lg:text-heading-h1-40 text-balance">
            Kenalan dengan ARIF-Net, mesin prediksi Kawan Pasar.
          </h1>
          <p className="text-body-medium-15 max-w-2xl text-surface/90">
            Model yang dikembangkan untuk memperkirakan perubahan harga komoditas pangan hingga 1
            tahun ke depan. Di sini kami jelaskan masalahnya, cara kerjanya, hasil uji, dan
            keterbatasannya dengan bahasa sederhana.
          </p>
        </div>
        <div className="w-full max-w-xs shrink-0 overflow-hidden rounded-xl bg-terong-100">
          <Illustration name="arif-net" />
        </div>
      </section>

      <div className="grid gap-4 md:grid-cols-[repeat(3,minmax(0,1fr))]">
        {[
          [
            'Masalah',
            'Harga cabai sering diam beberapa hari lalu melonjak tiba-tiba. Model umum cenderung meleset saat lonjakan dan untuk perkiraan jangka panjang.',
            'bg-surface border border-line',
          ],
          [
            'Apa yang dilakukan',
            'Memisahkan dua pertanyaan: apakah harga akan berubah, dan seberapa besar. Lalu menambahkan arah tren jangka panjang dan pola musiman.',
            'bg-terong-100',
          ],
          [
            'Hasil untuk Anda',
            'Perkiraan harga per komoditas untuk 1, 3, 7, 14, 30, 90, 180, dan 365 hari, sebagai gambaran anggaran belanja.',
            'bg-green-100',
          ],
        ].map(([title, body, cls]) => (
          <section key={title} className={`rounded-xl p-5 ${cls ?? ''}`}>
            <h2 className="text-overline-11 text-muted-text uppercase">{title}</h2>
            <p className="mt-2 text-body-small-13 text-ink-2">{body}</p>
          </section>
        ))}
      </div>

      <section aria-labelledby="alur-title" className="flex flex-col gap-4">
        <SectionHeader
          id="alur-title"
          title="Dari data pasar ke perkiraan harga"
          description="Kawan Pasar hanya menampilkan hasil model yang sudah divalidasi dan diberi versi."
        />
        <ol className="grid grid-cols-[repeat(2,minmax(0,1fr))] gap-3 md:grid-cols-[repeat(3,minmax(0,1fr))] lg:grid-cols-[repeat(6,minmax(0,1fr))]">
          {PIPELINE.map((s, i) => (
            <li
              key={s.title}
              className={`flex flex-col gap-1 rounded-lg p-4 ${i === PIPELINE.length - 2 ? 'bg-terong-600 text-surface' : 'border border-line bg-surface'}`}
            >
              <span className="font-mono text-[12px] font-semibold">
                {String(i + 1).padStart(2, '0')}
              </span>
              <span className="text-sm font-bold">{s.title}</span>
              <span className="text-[12px]">{s.note}</span>
            </li>
          ))}
        </ol>
      </section>

      <section aria-labelledby="bagian-title" className="flex flex-col gap-4">
        <SectionHeader
          id="bagian-title"
          title="Empat bagian yang bekerja bersama"
          description="Setiap bagian menjawab celah yang ditemukan saat menguji model-model terdahulu pada data harga pangan."
        />
        <ul className="grid gap-3 md:grid-cols-[repeat(2,minmax(0,1fr))]">
          {PARTS.map((p, i) => (
            <li key={p.title} className="rounded-xl border border-line bg-surface p-5">
              <p className="font-mono text-[12px] font-semibold text-terong-600">
                {String(i + 1).padStart(2, '0')}
              </p>
              <h3 className="mt-1 text-heading-card-16">{p.title}</h3>
              <p className="mt-1 text-body-small-13 text-ink-2">{p.body}</p>
            </li>
          ))}
        </ul>
      </section>

      <section aria-labelledby="akurasi-title" className="flex flex-col gap-4">
        <SectionHeader
          id="akurasi-title"
          title="Seberapa akurat ARIF-Net?"
          description="Rata-rata galat relatif (relMAE) pada data validasi, 5 kali percobaan. Lebih kecil = lebih akurat; 1,000 = sama dengan menebak harga tetap."
        />
        <div className="rounded-xl border border-line bg-surface p-5 sm:p-6">
          <div
            tabIndex={0}
            role="region"
            aria-label="Tabel akurasi (bisa digeser)"
            className="relative overflow-x-auto"
          >
            <table className="w-full min-w-[18rem] text-left text-sm">
              <caption className="sr-only">Akurasi ARIF-Net dan model pembanding (relMAE)</caption>
              <thead className="sr-only">
                <tr>
                  <th scope="col">Model</th>
                  <th scope="col">Perbandingan</th>
                  <th scope="col">relMAE</th>
                </tr>
              </thead>
              <tbody>
                {ACCURACY.map((r, i) => (
                  <tr key={r.model}>
                    <th
                      scope="row"
                      className={`w-[42%] py-1.5 pr-3 font-medium sm:w-[35%] ${i === 0 ? 'text-terong-600' : ''}`}
                    >
                      {r.model}
                      <span className="block text-[11px] font-normal text-muted-text">
                        {r.note}
                      </span>
                    </th>
                    <td className="py-1.5" aria-hidden="true">
                      <span className="block h-2.5 rounded-full bg-surface-2">
                        <span
                          className={`block h-2.5 rounded-full ${i === 0 ? 'bg-terong-600' : 'bg-line'}`}
                          style={{ width: `${String((r.relMae / maxBar) * 100)}%` }}
                        />
                      </span>
                    </td>
                    <td className="tabular w-16 py-1.5 pl-3 text-right font-mono font-semibold">
                      {fmt(r.relMae)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="mt-4 text-[12px] text-muted-text">
            Sumber: repositori ARIF-Net v1.1.0 (run ulang 10–17 November 2026), model A0 yang
            dibekukan dan dipakai Kawan Pasar. Selisih dengan BiLSTM tipis (0,013); uji prospektif
            buta dibuka sesudah {formatDateWib(PROSPECTIVE_OPENS, 'long')} dan menjadi penentu klaim
            keunggulan.
          </p>
        </div>
        <div className="rounded-xl border border-line bg-surface p-5 sm:p-6">
          <h3 className="text-heading-card-16">Per komoditas dan horizon</h3>
          <p className="mt-1 text-body-small-13 text-ink-2">
            Di bawah 1,000 berarti lebih akurat daripada menebak harga tetap. Sel yang ditebalkan
            tidak lebih baik, dan prediksinya ditandai &ldquo;Sebagian&rdquo; di halaman Prediksi.
          </p>
          <div
            tabIndex={0}
            role="region"
            aria-label="Tabel akurasi per horizon (bisa digeser)"
            className="relative mt-4 overflow-x-auto"
          >
            <table className="w-full min-w-[36rem] text-left text-sm">
              <caption className="sr-only">
                Akurasi ARIF-Net per komoditas dan horizon (relMAE validasi)
              </caption>
              <thead>
                <tr className="text-[12px] text-muted-text">
                  <th scope="col" className="py-1.5 pr-3 font-medium">
                    Komoditas
                  </th>
                  {ACCURACY_HORIZONS.map((h) => (
                    <th key={h} scope="col" className="py-1.5 pl-2 text-right font-medium">
                      {h} hari
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {ACCURACY_BY_HORIZON.map((row) => (
                  <tr key={row.commodity} className="border-t border-line">
                    <th scope="row" className="py-2 pr-3 font-medium">
                      {row.commodity}
                    </th>
                    {row.relMae.map((v, i) => (
                      <td
                        key={ACCURACY_HORIZONS[i]}
                        className={`tabular py-2 pl-2 text-right font-mono ${v >= 1 ? 'font-bold text-chili-700' : ''}`}
                      >
                        {fmt(v)}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </section>

      <section className="grid overflow-hidden rounded-xl border border-line bg-surface md:grid-cols-[minmax(0,2fr)_minmax(0,3fr)]">
        <div className="flex items-center justify-center bg-green-100 p-4">
          <Illustration name="peta" className="max-h-56" />
        </div>
        <div className="flex flex-col gap-3 p-5 sm:p-8">
          <h2 className="text-heading-title-20">Mulai dari Kramat Jati, lalu meluas</h2>
          <p className="text-body-small-13 text-ink-2">
            Harga tiap daerah berbeda, jadi Kawan Pasar akan menyediakan harga dan prediksi per
            pasar/wilayah secara bertahap.
          </p>
          <ol className="grid gap-2 sm:grid-cols-[repeat(3,minmax(0,1fr))]">
            {[
              [
                'Tahap 1 · sekarang',
                'Pasar Kramat Jati; cabai merah keriting, bawang merah, beras medium I.',
              ],
              ['Tahap 2 · pengembangan', 'Pasar/wilayah lain dan cabai rawit hijau & merah.'],
              [
                'Tahap 3 · operasional',
                'Pengumpulan data dan pembaruan model otomatis setiap minggu.',
              ],
            ].map(([t, b], i) => (
              <li
                key={t}
                className={`rounded-lg p-3 ${i === 0 ? 'border border-green-900 bg-green-100' : 'border border-line'}`}
              >
                <p className="text-overline-11 text-muted-text uppercase">{t}</p>
                <p className="mt-1 text-[12px] text-ink-2">{b}</p>
              </li>
            ))}
          </ol>
        </div>
      </section>

      <section className="flex flex-col items-center gap-4 rounded-xl bg-surface-2 p-6 sm:flex-row">
        <KapaMotion>
          <Kapa pose="prediksi" size={96} />
        </KapaMotion>
        <div className="flex min-w-0 flex-1 flex-col gap-1">
          <h2 className="flex items-center gap-2 text-heading-card-16">
            <FeatureIcon name="info" /> Jujur soal batasannya
          </h2>
          <p className="text-body-small-13 text-ink-2">
            Data, model, cara membaca, dan produk masing-masing punya batas. Baca sebelum memakai
            angka prediksi.
          </p>
        </div>
        <Button href="/arif-net/keterbatasan" arrow>
          Baca keterbatasan
        </Button>
      </section>
    </PageContainer>
  );
}
