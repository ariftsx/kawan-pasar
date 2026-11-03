import { FeatureIcon, type FeatureIconName } from '@/components/brand/feature-icon';

import { StatusChip, type ChipTone } from './blocks';

import type { ContextAvailability } from '@/lib/outlook/schema';

// Context signals (Arsy's data work): what the model may take into account. Shown as
// availability only; Kawan Pasar never says a signal caused a price change.

const SIGNALS: readonly {
  key: keyof ContextAvailability;
  icon: FeatureIconName;
  title: string;
  body: string;
}[] = [
  {
    key: 'climate',
    icon: 'cuaca',
    title: 'Cuaca di wilayah pemasok',
    body: 'Curah hujan dan suhu di kabupaten sentra (Open-Meteo).',
  },
  {
    key: 'news',
    icon: 'berita',
    title: 'Berita dan sentimen',
    body: 'Jumlah berita dan sentimen IndoBERT tentang komoditas ini.',
  },
  {
    key: 'calendar',
    icon: 'kalender',
    title: 'Kalender',
    body: 'Hari besar keagamaan, libur nasional, dan musim.',
  },
  {
    key: 'macro_logistics',
    icon: 'pasar',
    title: 'Biaya distribusi',
    body: 'Harga BBM dan jarak tempuh dari daerah pemasok (OSRM).',
  },
];

const STATUS: Record<string, { label: string; tone: ChipTone }> = {
  available: { label: 'Tersedia', tone: 'brand' },
  partial: { label: 'Sebagian', tone: 'highlight' },
};

export function ContextGrid({
  availability,
}: {
  readonly availability: ContextAvailability | null;
}) {
  return (
    <ul className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-4">
      {SIGNALS.map((signal) => {
        const value = availability?.[signal.key] ?? 'missing';
        const status = STATUS[value] ?? { label: 'Belum tersedia', tone: 'neutral' as const };
        return (
          <li
            key={signal.key}
            className="flex flex-col gap-3 rounded-3xl border border-border-default bg-bg-surface p-5"
          >
            <span className="flex items-center justify-between gap-2">
              <span className="flex size-10 items-center justify-center rounded-2xl bg-bg-subtle">
                <FeatureIcon name={signal.icon} />
              </span>
              <StatusChip tone={status.tone}>{status.label}</StatusChip>
            </span>
            <span className="text-base font-bold">{signal.title}</span>
            <span className="text-sm text-text-secondary">{signal.body}</span>
          </li>
        );
      })}
    </ul>
  );
}
