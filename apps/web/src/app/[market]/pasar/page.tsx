import { MarketCodeSchema } from '@kawan-pasar/contracts';
import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import type { ReactNode } from 'react';
import { FeatureIcon } from '@/brand/FeatureIcon';
import { Chip } from '@/components/atoms/Chip';
import { SectionHeader } from '@/components/molecules/SectionHeader';
import { PageContainer } from '@/components/templates/SiteShell';
import { requireData } from '@/lib/api/client';
import { api } from '@/lib/api/endpoints';
import { pageMetadata } from '@/lib/seo';

/*
 * Data pages live under [market] and are reached through rewrites (`/pasar` → `/PIKJ/pasar`).
 * No params at build time → nothing is prerendered while the API is unreachable (Docker build);
 * the first request renders the page and ISR caches it (ADR 0009).
 */
export const revalidate = 86_400;
export const dynamicParams = true;

export function generateStaticParams(): { market: string }[] {
  return [];
}

export const metadata: Metadata = pageMetadata({
  title: 'Pilih pasar',
  description: 'Pasar yang datanya tersedia di Kawan Pasar dan yang segera menyusul.',
  path: '/pasar',
});

export default async function MarketsPage({
  params,
}: {
  params: Promise<{ market: string }>;
}): Promise<ReactNode> {
  const market = MarketCodeSchema.safeParse((await params).market);
  if (!market.success) notFound();
  const { items } = requireData(await api.markets());
  return (
    <PageContainer className="flex flex-col gap-6 py-8 lg:py-14">
      <SectionHeader
        as="h1"
        title="Pilih pasar"
        description="Data harga saat ini tersedia untuk Pasar Kramat Jati. Pasar lain menyusul."
      />
      <ul className="grid grid-cols-[minmax(0,1fr)] gap-3 sm:grid-cols-[repeat(2,minmax(0,1fr))]">
        {items.map((m) => (
          <li
            key={m.code}
            aria-current={m.code === market.data ? 'true' : undefined}
            className="flex min-w-0 flex-wrap items-center gap-3 rounded-lg border border-line bg-surface p-4"
          >
            <span className="inline-flex size-10 shrink-0 items-center justify-center rounded-[13px] bg-chili-100">
              <FeatureIcon name="pasar" />
            </span>
            <span className="flex min-w-0 flex-1 flex-col">
              <span className="font-bold">{m.name}</span>
              <span className="text-body-small-13 text-ink-2">{m.city}</span>
            </span>
            {m.status === 'available' ? (
              <Chip tone="green" size="S">
                {m.code === market.data ? '✓ Dipilih' : 'Tersedia'}
              </Chip>
            ) : (
              <Chip tone="neutral" size="S">
                Segera
              </Chip>
            )}
          </li>
        ))}
      </ul>
    </PageContainer>
  );
}
