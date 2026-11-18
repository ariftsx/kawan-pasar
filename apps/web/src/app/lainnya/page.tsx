import type { Metadata, Route } from 'next';
import Link from 'next/link';
import type { ReactNode } from 'react';
import { FeatureIcon } from '@/brand/FeatureIcon';
import type { FeatureIconName } from '@/brand/FeatureIcon';
import { Kapa } from '@/brand/Kapa';
import { Logo } from '@/brand/Logo';
import type { IconBoxTone } from '@/components/atoms/IconBox';
import { IconBox } from '@/components/atoms/IconBox';
import { PageContainer } from '@/components/templates/SiteShell';
import { pageMetadata } from '@/lib/seo';

export const metadata: Metadata = pageMetadata({
  title: 'Lainnya',
  description: 'Peringatan, ARIF-Net, cakupan data, edukasi, dan Mode Analis.',
  path: '/lainnya',
});

const ITEMS: readonly {
  href: Route | null;
  icon: FeatureIconName;
  tone: IconBoxTone;
  title: string;
  body: string;
}[] = [
  {
    href: '/akun',
    icon: 'centang',
    tone: 'green',
    title: 'Akun',
    body: 'Masuk, daftar, dan pengaturan akun',
  },
  {
    href: '/peringatan',
    icon: 'peringatan',
    tone: 'kunyit',
    title: 'Peringatan',
    body: 'Kabar harga & pengaturan WhatsApp (segera)',
  },
  {
    href: '/arif-net',
    icon: 'arif-net',
    tone: 'terong',
    title: 'Kenalan dengan ARIF-Net',
    body: 'Cara kerja, hasil uji, keterbatasan',
  },
  {
    href: '/pasar',
    icon: 'pasar',
    tone: 'chili',
    title: 'Cakupan data',
    body: 'Pasar & komoditas yang tersedia dan menyusul',
  },
  {
    href: '/edukasi',
    icon: 'edukasi',
    tone: 'green',
    title: 'Edukasi',
    body: 'Inflasi pangan, membaca harga & prediksi',
  },
  {
    href: null,
    icon: 'unduh',
    tone: 'surface',
    title: 'Mode Analis',
    body: 'Bandingkan & unduh data (segera)',
  },
];

/** Mobile "Lainnya" (v0.4): everything that does not fit in the bottom tabs. */
export default function Lainnya(): ReactNode {
  return (
    <PageContainer className="flex flex-col gap-6 py-6 lg:py-10">
      <h1 className="text-heading-h2-32">Lainnya</h1>
      <ul className="divide-y divide-line overflow-hidden rounded-xl border border-line bg-surface">
        {ITEMS.map((i) => {
          const content = (
            <>
              <IconBox tone={i.tone} size={40}>
                <FeatureIcon name={i.icon} />
              </IconBox>
              <span className="flex min-w-0 flex-1 flex-col">
                <span className="font-bold">{i.title}</span>
                <span className="text-body-small-13 text-ink-2">{i.body}</span>
              </span>
            </>
          );
          return (
            <li key={i.title}>
              {i.href === null ? (
                <span className="flex min-h-16 items-center gap-3 p-4">{content}</span>
              ) : (
                <Link
                  href={i.href}
                  className="flex min-h-16 items-center gap-3 p-4 hover:bg-surface-2"
                >
                  {content}
                  <FeatureIcon name="panah" size={20} />
                </Link>
              )}
            </li>
          );
        })}
      </ul>
      <section className="flex items-center gap-4 rounded-xl bg-green-100 p-5">
        <Kapa pose="senang" size={84} />
        <div className="min-w-0">
          <Logo size={32} />
          <p className="mt-2 text-body-small-13 text-ink-2">
            Tim ARIF-Net. Prediksi adalah estimasi, bukan jaminan harga.
          </p>
        </div>
      </section>
    </PageContainer>
  );
}
