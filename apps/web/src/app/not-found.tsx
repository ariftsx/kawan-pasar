import type { Metadata } from 'next';
import type { ReactNode } from 'react';
import { Button } from '@/components/atoms/Button';
import { StatePanel } from '@/components/molecules/StatePanel';
import { PageContainer } from '@/components/templates/SiteShell';

export const metadata: Metadata = { title: 'Halaman tidak ditemukan' };

export default function NotFound(): ReactNode {
  return (
    <PageContainer className="py-8 lg:py-14">
      <StatePanel
        headingLevel={1}
        pose="belajar"
        chip="404"
        title="Halaman tidak ditemukan"
        body="Alamat yang Anda buka tidak ada atau sudah dipindahkan."
        action={<Button href="/beranda">Ke Beranda</Button>}
      />
    </PageContainer>
  );
}
