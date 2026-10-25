import { ComingSoon } from '@/components/coming-soon';

import type { Metadata } from 'next';

export const metadata: Metadata = { title: 'Pelajari' };

export default function PelajariPage() {
  return (
    <ComingSoon
      title="Pelajari"
      phase="F5"
      description="Penjelasan singkat tentang harga pasar, cara membaca perkiraan, dan data yang dipakai."
    />
  );
}
