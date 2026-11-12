import type { Metadata } from 'next';
import type { ReactNode } from 'react';
import { ComingSoonPage } from '@/components/templates/ComingSoonPage';

export const metadata: Metadata = { title: 'Edukasi' };

export default function Page(): ReactNode {
  return <ComingSoonPage title="Belajar sambil belanja" />;
}
