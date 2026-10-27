import { ButtonLink } from '@kawan-pasar/ui';

import { DemoCostCard } from '@/app/demo-cost-card';
import { Spot, type SpotName } from '@/components/illustrations';
import { BakulSays } from '@/components/mascot/bakul-says';

const STEPS: readonly { art: SpotName; title: string; body: string }[] = [
  { art: 'warung', title: 'Pilih jenis warung', body: 'Warteg, masakan Padang, atau ayam geprek.' },
  {
    art: 'piring',
    title: 'Pilih menu dan porsi',
    body: 'Takaran bahan sudah terisi. Anda bisa mengubahnya nanti.',
  },
  { art: 'nota', title: 'Lihat modal per porsi', body: 'Untuk hari ini dan 7 hari lagi.' },
];

function Hero() {
  return (
    <section className="grid items-center gap-6 md:grid-cols-2 md:gap-12">
      <BakulSays pose="wave" size="lg" isAnimated className="md:order-last">
        Halo, saya <strong>Si Bakul</strong>. Saya bantu hitung modal bahan di warung Anda.
      </BakulSays>
      <div className="flex flex-col gap-5">
        <h1 className="text-3xl font-bold md:text-4xl">
          Berapa modal satu porsi menu Anda hari ini?
        </h1>
        <p className="max-w-prose text-lg text-text-secondary">
          Pilih menu yang Anda jual, lalu Kawan Pasar menghitung harga bahannya. Gratis, tanpa
          daftar akun, dan datanya tetap di HP Anda.
        </p>
        <div className="flex flex-col gap-3 md:flex-row">
          <ButtonLink href="/atur-warung" size="lg">
            Mulai atur warung
          </ButtonLink>
          <ButtonLink href="#contoh" variant="secondary" size="lg">
            Lihat contoh
          </ButtonLink>
        </div>
      </div>
    </section>
  );
}

function Steps() {
  return (
    <section aria-labelledby="cara-title" className="flex flex-col gap-4">
      <h2 id="cara-title" className="text-2xl font-bold">
        Caranya cukup 3 langkah
      </h2>
      <ol className="grid gap-3 md:grid-cols-3 md:gap-6">
        {STEPS.map((step, index) => (
          <li
            key={step.title}
            className="flex items-center gap-4 rounded-xl bg-bg-subtle p-4 md:flex-col md:items-start"
          >
            <Spot name={step.art} className="w-24 shrink-0 md:w-32" />
            <div className="flex flex-col gap-1">
              <p className="flex items-center gap-2 text-lg font-bold">
                <span className="flex size-8 shrink-0 items-center justify-center rounded-full bg-bg-brand text-base text-text-on-brand">
                  {index + 1}
                </span>
                {step.title}
              </p>
              <p className="text-base text-text-secondary">{step.body}</p>
            </div>
          </li>
        ))}
      </ol>
    </section>
  );
}

/** Beranda publik (docs 09 §5.1): server-rendered, no login, value in under a minute (G-01). */
export function PublicHome() {
  return (
    <div className="flex flex-col gap-12">
      <Hero />
      <Steps />
      <section
        id="contoh"
        aria-labelledby="contoh-title"
        className="flex scroll-mt-20 flex-col gap-4"
      >
        <h2 id="contoh-title" className="text-2xl font-bold">
          Contoh hasil hitungan
        </h2>
        <DemoCostCard />
      </section>

      <section className="flex flex-col gap-2 rounded-xl border-2 border-border-default p-5">
        <h2 className="text-xl font-bold">Dari mana harganya?</h2>
        <p className="max-w-prose text-base text-text-secondary">
          Harga harian diambil dari Pasar Kramatjati, untuk cabai merah keriting, bawang merah, dan
          beras medium. Perkiraan 7 hari dibuat oleh model riset ARIF-Net yang masih dalam
          pengembangan, jadi angkanya diberi label DATA DEMO.
        </p>
      </section>
    </div>
  );
}
