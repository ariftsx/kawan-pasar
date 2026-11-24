import type { Metadata } from 'next';
import type { ReactNode } from 'react';
import { Kapa } from '@/brand/Kapa';
import { KapaMotion } from '@/brand/KapaMotion';
import { Button } from '@/components/atoms/Button';
import { Chip } from '@/components/atoms/Chip';
import { Disclaimer } from '@/components/atoms/Disclaimer';
import { KataKapa } from '@/components/molecules/KataKapa';
import { SectionHeader } from '@/components/molecules/SectionHeader';
import { CommodityFilter } from '@/components/organisms/CommodityFilter';
import { CoverageCard } from '@/components/organisms/CoverageCard';
import { ForecastTeaser } from '@/components/organisms/ForecastTeaser';
import { FreshnessNotice } from '@/components/organisms/FreshnessNotice';
import { HighlightCards } from '@/components/organisms/HighlightCards';
import { LearnTeaser } from '@/components/organisms/LearnTeaser';
import { PredictionMeta } from '@/components/organisms/PredictionMeta';
import { PriceGrid } from '@/components/organisms/PriceGrid';
import { PageContainer } from '@/components/templates/SiteShell';
import { requireData } from '@/lib/api/client';
import { api } from '@/lib/api/endpoints';
import { formatDateWib } from '@/lib/format';
import { weeklyHighlights } from '@/lib/insights/highlights';
import { kataKapa } from '@/lib/insights/kata-kapa';
import { FEATURED_COMMODITY, marketFrom } from '@/lib/page-params';
import { pageMetadata } from '@/lib/seo';

export const revalidate = 600;
export const dynamicParams = true;
export function generateStaticParams(): { market: string }[] {
  return [];
}

export const metadata: Metadata = pageMetadata({
  title: 'Beranda',
  description: 'Harga harian 5 komoditas pokok di Pasar Kramat Jati dan perkiraannya.',
  path: '/beranda',
});

export default async function Beranda({
  params,
}: {
  params: Promise<{ market: string }>;
}): Promise<ReactNode> {
  const market = await marketFrom(params);
  const [summaryRes, forecastRes, historyRes, articlesRes] = await Promise.all([
    api.priceSummary(market),
    api.forecast(market, FEATURED_COMMODITY),
    api.history(market, FEATURED_COMMODITY, '90d'),
    api.articles(),
  ]);
  const summary = requireData(summaryRes);
  const forecast = requireData(forecastRes);
  const history = requireData(historyRes);
  const { items: articles } = requireData(articlesRes);

  const highlights = weeklyHighlights(summary.items);
  const featured = summary.items.find((i) => i.code === FEATURED_COMMODITY);
  const tip = featured === undefined ? null : kataKapa(featured);
  // Fase 4C K1: the coverage comes from the API (it follows the active bundle).
  const covered = summary.items.filter((i) => i.modelCoverage === 'covered').length;
  const artifact = summary.forecastArtifact;

  return (
    <PageContainer className="flex flex-col gap-10 py-6 lg:gap-14 lg:py-10">
      <section className="flex flex-col items-center gap-6 overflow-hidden rounded-2xl bg-green-900 p-6 text-surface sm:flex-row sm:p-10 lg:p-14">
        <div className="flex min-w-0 flex-1 flex-col items-start gap-4">
          <p className="flex flex-wrap gap-2">
            <Chip tone="dark" size="S">
              {summary.latestObservedOn === null
                ? 'Data belum tersedia'
                : `Data per ${formatDateWib(summary.latestObservedOn, 'short')}`}
            </Chip>
            {artifact?.isDemo === true ? (
              <Chip tone="kunyit-solid" size="S">
                Data demo
              </Chip>
            ) : null}
          </p>
          <h1 className="text-heading-h2-32 lg:text-display-56 text-balance">
            Cek harga dulu, belanja lebih tenang.
          </h1>
          <p className="text-body-medium-15 lg:text-body-large-17 max-w-xl text-surface/85">
            Harga harian 5 komoditas pokok di {summary.market.name}, lengkap dengan perkiraan hingga
            1 tahun ke depan. Jadi Anda punya gambaran pengeluaran sebelum berangkat ke pasar.
          </p>
          <div className="flex flex-wrap gap-3">
            <Button href="/harga" variant="primary" arrow>
              Lihat harga hari ini
            </Button>
            <Button href="/arif-net" variant="inverse">
              Kenali ARIF-Net
            </Button>
          </div>
        </div>
        <div className="flex shrink-0 flex-col items-center gap-2">
          <p className="max-w-56 rounded-lg bg-surface px-4 py-3 text-body-small-13 text-ink shadow-[0_8px_24px_#0000001f]">
            <strong>Hai, aku Kapa!</strong> Aku bantu pantau harga pangan sebelum kamu ke pasar.
          </p>
          <KapaMotion>
            <Kapa pose="halo" size={160} />
          </KapaMotion>
        </div>
      </section>

      <FreshnessNotice
        latestObservedOn={summary.latestObservedOn}
        staleAtRender={summary.items.some((i) => i.dataStatus === 'stale')}
      />

      <HighlightCards highlights={highlights} />

      <section aria-labelledby="harga-title" className="flex flex-col gap-5">
        <SectionHeader
          id="harga-title"
          title="Harga hari ini"
          description={`${summary.market.name} · per kg · sumber PIHPS`}
          action={
            <CommodityFilter
              targetId="beranda-harga"
              total={summary.items.length}
              covered={covered}
            />
          }
        />
        <PriceGrid id="beranda-harga" items={summary.items} />
        {artifact === null ? null : (
          <PredictionMeta
            artifact={artifact}
            expired={summary.items.some((i) => i.forecast7d.status === 'expired')}
          />
        )}
      </section>

      <div className="grid items-start gap-6 lg:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]">
        <ForecastTeaser forecast={forecast} actual={history.points} />
        {tip === null ? null : (
          <KataKapa
            pose={tip.pose}
            title={tip.title}
            body={tip.body}
            action={
              <Button href="/edukasi" variant="ghost" size="S" arrow>
                Pelajari cara membaca harga
              </Button>
            }
          />
        )}
      </div>

      <section aria-labelledby="belajar-title" className="flex flex-col gap-5">
        <SectionHeader
          id="belajar-title"
          title="Belajar sambil belanja"
          description="Pahami inflasi pangan dan cara membaca prediksi, dalam 5 menit."
          action={
            <Button href="/edukasi" variant="ghost" size="S" arrow>
              Semua topik edukasi
            </Button>
          }
        />
        <LearnTeaser articles={articles} />
      </section>

      <CoverageCard marketName={summary.market.name} coveredCount={covered} />
      <Disclaimer />
    </PageContainer>
  );
}
