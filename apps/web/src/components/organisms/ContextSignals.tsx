import type { ReactNode } from 'react';
import { FeatureIcon } from '@/brand/FeatureIcon';
import type { FeatureIconName } from '@/brand/FeatureIcon';
import { Chip } from '../atoms/Chip';
import { IconBox } from '../atoms/IconBox';

const SIGNALS: readonly { icon: FeatureIconName; title: string; body: string }[] = [
  {
    icon: 'cuaca',
    title: 'Cuaca di wilayah pemasok',
    body: 'Curah hujan di sentra produksi.',
  },
  {
    icon: 'berita',
    title: 'Berita & sentimen',
    body: 'Ringkasan berita tentang komoditas ini.',
  },
  { icon: 'kalender', title: 'Kalender', body: 'Hari raya dan musim panen.' },
  {
    icon: 'pasar',
    title: 'Biaya distribusi',
    body: 'Ongkos angkut dari pemasok ke pasar.',
  },
];

/**
 * Context signals (v0.4 Detail "Konteks"). The data sources are not connected yet, so every card
 * says so; no figure is shown until real data exists (design §10).
 */
export function ContextSignals(): ReactNode {
  return (
    <section aria-label="Konteks yang tersedia" className="flex flex-col gap-4">
      <div>
        <h2 className="text-heading-h3-24">Konteks yang tersedia</h2>
        <p className="text-body-small-13 text-ink-2">
          Informasi yang nantinya dipakai sebagai pertimbangan, bukan penyebab pasti perubahan
          harga.
        </p>
      </div>
      <ul className="grid gap-3 sm:grid-cols-[repeat(2,minmax(0,1fr))] lg:grid-cols-[repeat(4,minmax(0,1fr))]">
        {SIGNALS.map((s) => (
          <li
            key={s.title}
            className="flex flex-col gap-3 rounded-xl border border-line bg-surface p-5"
          >
            <div className="flex items-start justify-between gap-2">
              <IconBox tone="surface" size={40}>
                <FeatureIcon name={s.icon} />
              </IconBox>
              <Chip tone="neutral" size="S">
                Sinyal menyusul
              </Chip>
            </div>
            <h3 className="text-heading-card-16">{s.title}</h3>
            <p className="text-body-small-13 text-ink-2">{s.body}</p>
          </li>
        ))}
      </ul>
    </section>
  );
}
