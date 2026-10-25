import { ComingSoon } from '@/components/coming-soon';

import type { Metadata } from 'next';

export const metadata: Metadata = { title: 'Konteks' };

export default function KonteksPage() {
  return (
    <ComingSoon
      title="Konteks"
      phase="F5"
      description="Informasi iklim, berita, dan logistik yang tersedia saat data perkiraan dipotong. Informasi ini bukan penyebab pergerakan harga."
    />
  );
}
