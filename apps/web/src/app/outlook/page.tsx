import { ComingSoon } from '@/components/coming-soon';

import type { Metadata } from 'next';

export const metadata: Metadata = { title: 'Outlook Harga' };

export default function OutlookPage() {
  return (
    <ComingSoon
      title="Outlook Harga ★"
      phase="F4"
      description="Grafik perkiraan harga dan pengaruhnya ke modal menu Anda. Sementara itu, perkiraan 7 hari (DATA DEMO) sudah dipakai di Rencana Menu."
    />
  );
}
