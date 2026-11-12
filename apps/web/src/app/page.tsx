import type { ReactNode } from 'react';
import { Kapa } from '@/brand/Kapa';
import { KapaMotion } from '@/brand/KapaMotion';
import { Button } from '@/components/atoms/Button';
import { PageContainer } from '@/components/templates/SiteShell';

/** Temporary home (Fase 1B). Fase 1C replaces it with the first-visit orientation page. */
export default function HomePage(): ReactNode {
  return (
    <PageContainer className="py-6 lg:py-10">
      <section className="flex flex-col items-center gap-6 overflow-hidden rounded-2xl bg-green-900 p-6 text-surface sm:flex-row sm:p-10 lg:p-14">
        <div className="flex min-w-0 flex-1 flex-col items-start gap-4">
          <h1 className="text-heading-h2-32 lg:text-display-56 text-balance">
            Cek harga dulu, belanja lebih tenang.
          </h1>
          <p className="text-body-medium-15 lg:text-body-large-17 max-w-xl text-surface/85">
            Harga harian komoditas pokok di Pasar Kramat Jati, lengkap dengan perkiraannya. Halaman
            lengkap sedang disiapkan.
          </p>
          <div className="flex flex-wrap gap-3">
            <Button href="/pasar" variant="primary" arrow>
              Lihat pasar
            </Button>
            <Button href="/arif-net" variant="inverse">
              Kenali ARIF-Net
            </Button>
          </div>
        </div>
        <KapaMotion>
          <Kapa pose="halo" size={180} />
        </KapaMotion>
      </section>
    </PageContainer>
  );
}
