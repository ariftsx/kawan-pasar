import { ComingSoon } from '@/components/coming-soon';

import type { Metadata } from 'next';

export const metadata: Metadata = { title: 'Konteks' };

export default function KonteksPage() {
  return (
    <ComingSoon
      title="Konteks"
      phase="F5"
      description="Kabar cuaca, berita, dan pengiriman barang di sekitar tanggal perkiraan dibuat. Informasi ini bukan penyebab naik turunnya harga."
    />
  );
}
