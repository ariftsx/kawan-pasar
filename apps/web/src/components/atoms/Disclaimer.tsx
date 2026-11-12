import type { ReactNode } from 'react';
import { cx } from '@/lib/cx';

/** Mandatory statement on every forecast view (product rule). */
export function Disclaimer({ className }: { className?: string }): ReactNode {
  return (
    <p className={cx('text-body-small-13 text-ink-2', className)}>
      Prediksi adalah estimasi model, <strong>bukan jaminan harga</strong> dan bukan rekomendasi
      jual/beli.
    </p>
  );
}
