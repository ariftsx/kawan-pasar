import type { Metadata } from 'next';
import type { ReactNode } from 'react';
import { ComingSoonPage } from '@/components/templates/ComingSoonPage';

export const metadata: Metadata = { title: 'Prediksi' };

export default function Page(): ReactNode {
  return <ComingSoonPage title="Prediksi harga" />;
}
