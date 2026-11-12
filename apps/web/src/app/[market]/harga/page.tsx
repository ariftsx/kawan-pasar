import { COMMODITIES } from '@kawan-pasar/catalog';
import type { Metadata } from 'next';
import type { ReactNode } from 'react';
import { Button } from '@/components/atoms/Button';
import { Disclaimer } from '@/components/atoms/Disclaimer';
import { PriceChart } from '@/components/charts/PriceChart';
import { CoverageStrip } from '@/components/molecules/CoverageStrip';
import { KataKapa } from '@/components/molecules/KataKapa';
import { CommodityFilter } from '@/components/organisms/CommodityFilter';
import { FreshnessNotice } from '@/components/organisms/FreshnessNotice';
import { PredictionMeta } from '@/components/organisms/PredictionMeta';
import { PriceTable } from '@/components/organisms/PriceTable';
import { PageContainer } from '@/components/templates/SiteShell';
import { requireData } from '@/lib/api/client';
import { api } from '@/lib/api/endpoints';
import { formatDateWib } from '@/lib/format';
import { hrefs } from '@/lib/hrefs';
import { kataKapa } from '@/lib/insights/kata-kapa';
import { FEATURED_COMMODITY, marketFrom } from '@/lib/page-params';
import { pageMetadata } from '@/lib/seo';

export const revalidate = 600;
export const dynamicParams = true;
export function generateStaticParams(): { market: string }[] {
  return [];
}

export const metadata: Metadata = pageMetadata({
  title: 'Harga komoditas',
  description: 'Harga harian cabai, bawang merah, dan beras di Pasar Kramat Jati.',
  path: '/harga',
});

export default async function Harga({
  params,
}: {
  params: Promise<{ market: string }>;
}): Promise<ReactNode> {
  const market = await marketFrom(params);
  const [summaryRes, year, all] = await Promise.all([
    api.priceSummary(market),
    api.history(market, FEATURED_COMMODITY, '365d'),
    api.history(market, FEATURED_COMMODITY, 'all'),
  ]);
  const summary = requireData(summaryRes);
  const points365 = requireData(year).points;
  const pointsAll = requireData(all).points;
  const featured = summary.items.find((i) => i.code === FEATURED_COMMODITY);
  const tip = featured === undefined ? null : kataKapa(featured);
  const covered = COMMODITIES.filter((c) => c.modelCoverage === 'covered').length;

  return (
    <PageContainer className="flex flex-col gap-8 py-6 lg:py-10">
      <header className="flex flex-col gap-2">
        <p className="text-overline-11 text-green-700 uppercase">Harga komoditas</p>
        <h1 className="text-heading-h2-32 lg:text-heading-h1-40">Harga pangan hari ini</h1>
        <p className="text-body-medium-15 max-w-2xl text-ink-2">
          Harga observasi {summary.market.name} dari PIHPS
          {summary.latestObservedOn === null
            ? ''
            : `, terakhir ${formatDateWib(summary.latestObservedOn, 'long')}`}
          . Bukan harga real-time.
        </p>
      </header>

      <FreshnessNotice
        latestObservedOn={summary.latestObservedOn}
        staleAtRender={summary.items.some((i) => i.dataStatus === 'stale')}
      />

      <CoverageStrip
        title={`Data saat ini: ${summary.market.name} · ${String(covered)} komoditas bisa diprediksi`}
        body="Pasar/wilayah lain serta cabai rawit hijau dan cabai rawit merah sedang dikembangkan."
        action={
          <Button href="/arif-net/keterbatasan" variant="ghost" size="S" arrow>
            Rencana pengembangan
          </Button>
        }
      />

      <section aria-label="Daftar harga" className="flex flex-col gap-4">
        <CommodityFilter
          targetId="harga-tabel"
          total={summary.items.length}
          covered={covered}
          search
        />
        <PriceTable
          id="harga-tabel"
          caption={`Harga komoditas ${summary.market.name} per kg`}
          items={summary.items}
        />
        {summary.forecastArtifact === null ? null : (
          <PredictionMeta
            artifact={summary.forecastArtifact}
            expired={summary.items.some((i) => i.forecast7d.status === 'expired')}
          />
        )}
      </section>

      <div className="grid items-start gap-6 lg:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]">
        <section className="flex min-w-0 flex-col gap-4 rounded-xl border border-line bg-surface p-5 sm:p-6">
          <PriceChart
            id="harga-riwayat"
            title={`Riwayat harga · ${featured?.name ?? 'Cabai merah keriting'}`}
            description={`${summary.market.name} · Rp/kg · observasi aktual`}
            points365={points365}
            pointsAll={pointsAll}
          />
          <Button
            href={hrefs.forecast(FEATURED_COMMODITY)}
            variant="ghost"
            size="S"
            arrow
            className="self-end"
          >
            Lihat prediksi komoditas ini
          </Button>
        </section>
        {tip === null ? null : (
          <KataKapa
            pose={tip.pose}
            title={tip.title}
            body={tip.body}
            action={
              <Button href="/peringatan" variant="ghost" size="S" arrow>
                Atur peringatan (segera)
              </Button>
            }
          />
        )}
      </div>
      <Disclaimer />
    </PageContainer>
  );
}
