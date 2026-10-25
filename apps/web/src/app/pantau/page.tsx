import { ComingSoon } from '@/components/coming-soon';

import type { Metadata } from 'next';

export const metadata: Metadata = { title: 'Pantau Harga' };

export default function PantauPage() {
  return (
    <ComingSoon
      title="Pantau Harga"
      phase="F2"
      description="Harga harian, riwayat, dan perubahan untuk cabai merah keriting, bawang merah, dan beras medium akan tampil setelah ingest harga harian aktif."
    />
  );
}
