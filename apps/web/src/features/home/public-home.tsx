import { ButtonLink, Card } from '@kawan-pasar/ui';

import { DemoCostCard } from '@/app/demo-cost-card';

const STEPS = [
  { title: 'Pilih jenis warung', body: 'Warteg, masakan Padang, atau ayam geprek.' },
  { title: 'Pilih menu & porsi', body: 'Mulai dari template, lalu sesuaikan takarannya.' },
  { title: 'Lihat modal per porsi', body: 'Hari ini dan perkiraan 7 hari lagi.' },
];

/** Beranda publik (docs 09 §5.1): server-rendered, no login, value in under a minute (G-01). */
export function PublicHome() {
  return (
    <div className="flex flex-col gap-8">
      <section className="flex flex-col gap-4 md:max-w-2xl">
        <p className="text-xs font-semibold tracking-widest text-text-brand uppercase">
          Kawan Pasar
        </p>
        <h1 className="text-3xl font-semibold tracking-tight md:text-4xl">
          Modal menu Anda, hari ini dan minggu depan
        </h1>
        <p className="text-text-secondary">
          Hitung modal per porsi dari harga bahan terbaru, lalu lihat bahan mana yang paling
          berisiko. Tanpa daftar akun; data tersimpan di HP Anda.
        </p>
        <div className="flex flex-wrap gap-2">
          <ButtonLink href="/atur-warung">Atur warung dalam 2 menit</ButtonLink>
          <ButtonLink href="/pantau" variant="secondary">
            Pantau harga
          </ButtonLink>
        </div>
      </section>

      <ol className="grid gap-3 md:grid-cols-3">
        {STEPS.map((step, index) => (
          <li key={step.title}>
            <Card className="flex h-full flex-col gap-1">
              <span className="font-mono text-xs text-text-brand">Langkah {index + 1}</span>
              <span className="font-semibold">{step.title}</span>
              <span className="text-sm text-text-secondary">{step.body}</span>
            </Card>
          </li>
        ))}
      </ol>

      <section aria-label="Contoh perhitungan" className="flex flex-col gap-2">
        <h2 className="text-lg font-semibold">Contoh perhitungan</h2>
        <DemoCostCard />
      </section>

      <Card className="flex flex-col gap-2 text-sm text-text-secondary">
        <h2 className="text-base font-semibold text-text-primary">Transparan soal data</h2>
        <p>
          Harga harian baru tersedia untuk cabai merah keriting, bawang merah, dan beras medium di
          Pasar Kramatjati. Perkiraan dari model riset ARIF-Net masih dalam pengembangan, jadi
          angkanya diberi label DATA DEMO.
        </p>
      </Card>
    </div>
  );
}
