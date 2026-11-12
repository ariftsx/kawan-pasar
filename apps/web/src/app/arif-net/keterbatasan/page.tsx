import type { Metadata } from 'next';
import type { ReactNode } from 'react';
import { ComingSoonPage } from '@/components/templates/ComingSoonPage';

export const metadata: Metadata = { title: 'Keterbatasan' };

export default function Page(): ReactNode {
  return <ComingSoonPage title="Keterbatasan ARIF-Net" />;
}
