import { DemoBadge } from '@kawan-pasar/ui';

/** Shown on every page in demo mode (docs 10 §8.4); it cannot be dismissed. */
export function DemoBanner() {
  return (
    <div role="note" className="border-b border-border-default bg-demo-bg">
      <p className="mx-auto flex max-w-content flex-wrap items-center gap-2 px-4 py-2 text-sm text-demo-fg lg:px-12">
        <DemoBadge />
        <span>
          Mode demo: harga bahan dan perkiraan adalah contoh untuk menunjukkan cara kerja aplikasi.
        </span>
      </p>
    </div>
  );
}
