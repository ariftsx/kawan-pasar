import type { Metadata } from 'next';
import Link from 'next/link';
import type { ReactNode } from 'react';
import { CommodityIcon } from '@/brand/CommodityIcon';
import { Button } from '@/components/atoms/Button';
import { Chip } from '@/components/atoms/Chip';
import { Delta } from '@/components/atoms/Delta';
import { Disclaimer } from '@/components/atoms/Disclaimer';
import { IconBox } from '@/components/atoms/IconBox';
import { PredictionBadge } from '@/components/atoms/PredictionBadge';
import { Price } from '@/components/atoms/Price';
import { ForecastChart } from '@/components/charts/ForecastChart';
import { PriceChart } from '@/components/charts/PriceChart';
import { commodityTone } from '@/components/molecules/commodity-display';
import { KataKapa } from '@/components/molecules/KataKapa';
import { MetricCard } from '@/components/molecules/MetricCard';
import { ContextSignals } from '@/components/organisms/ContextSignals';
import { FreshnessNotice } from '@/components/organisms/FreshnessNotice';
import { PredictionMeta } from '@/components/organisms/PredictionMeta';
import { SystemState } from '@/components/organisms/SystemState';
import { PageContainer } from '@/components/templates/SiteShell';
import { requireData } from '@/lib/api/client';
import { api } from '@/lib/api/endpoints';
import { formatDateWib } from '@/lib/format';
import { hrefs } from '@/lib/hrefs';
import { changeWithReference } from '@/lib/insights/changes';
import { forecastView, noForecastKind } from '@/lib/insights/forecast-view';
import { kataKapa } from '@/lib/insights/kata-kapa';
import { commodityFrom, marketFrom } from '@/lib/page-params';
import { pageMetadata } from '@/lib/seo';

export const revalidate = 600;
export const dynamicParams = true;
export function generateStaticParams(): { market: string; commodity: string }[] {
  return [];
}

type Params = Promise<{ market: string; commodity: string }>;

export async function generateMetadata({ params }: { params: Params }): Promise<Metadata> {
  const c = commodityFrom((await params).commodity);
  return pageMetadata({
    title: `Harga ${c.name.toLowerCase()}`,
    description: `Harga harian, riwayat, dan perkiraan ${c.name.toLowerCase()} di Pasar Kramat Jati.`,
    path: hrefs.price(c.code),
  });
}

const SECTIONS = [
  ['ringkasan', 'Ringkasan'],
  ['riwayat', 'Riwayat'],
  ['prediksi', 'Prediksi'],
  ['konteks', 'Konteks'],
] as const;

export default async function Detail({ params }: { params: Params }): Promise<ReactNode> {
  const market = await marketFrom(params);
  const commodity = commodityFrom((await params).commodity);
  const [summaryRes, year, all, forecastRes] = await Promise.all([
    api.priceSummary(market),
    api.history(market, commodity.code, '365d'),
    api.history(market, commodity.code, 'all'),
    api.forecast(market, commodity.code),
  ]);
  const summary = requireData(summaryRes);
  const points365 = requireData(year).points;
  const pointsAll = requireData(all).points;
  const forecast = requireData(forecastRes);
  const item = summary.items.find((i) => i.code === commodity.code);
  const latest = item?.latest ?? null;
  const view = forecastView(forecast);
  const tip = item === undefined ? null : kataKapa(item);
  const h7 = forecast.horizons.find((h) => h.horizonDays === 7);

  return (
    <PageContainer className="flex flex-col gap-8 py-6 lg:py-10">
      <nav aria-label="Lokasi halaman" className="text-body-small-13">
        <ol className="flex flex-wrap gap-1.5 text-muted-text">
          <li>
            <Link href="/harga" className="font-semibold text-green-900 hover:underline">
              Harga
            </Link>
          </li>
          <li aria-hidden="true">/</li>
          <li aria-current="page">{commodity.name}</li>
        </ol>
      </nav>

      <header className="flex flex-col flex-wrap justify-between gap-5 rounded-xl border border-line bg-surface p-5 sm:flex-row sm:items-center sm:p-8">
        <div className="flex min-w-0 items-center gap-4">
          <IconBox tone={commodityTone(commodity.code)}>
            <CommodityIcon code={commodity.code} size={38} />
          </IconBox>
          <div className="flex min-w-0 flex-col gap-1.5">
            <h1 className="text-heading-h3-24 sm:text-heading-h1-40 text-balance">
              {commodity.name}
            </h1>
            <p className="flex flex-wrap gap-1.5">
              <Chip tone="neutral" size="S">
                {summary.market.name}
              </Chip>
              <Chip tone="neutral" size="S">
                per kg
              </Chip>
              {forecast.commodity.modelCoverage === 'covered' ? (
                <Chip tone="terong" size="S">
                  ★ Bisa diprediksi
                </Chip>
              ) : (
                <Chip tone="neutral" size="S">
                  Prediksi menyusul
                </Chip>
              )}
            </p>
            <p className="text-[12px] text-muted-text">
              {latest === null
                ? 'Data belum tersedia'
                : `Terakhir diperbarui ${formatDateWib(latest.observedOn, 'short')} · sumber PIHPS`}
            </p>
          </div>
        </div>
        <div className="flex flex-col items-start gap-2 sm:items-end">
          <Price value={item?.latest?.priceIdr ?? null} size="l" />
          <p className="flex flex-wrap gap-1.5">
            <Delta value={item?.change7d ?? null} />
            {item === undefined ? null : (
              <PredictionBadge
                status={item.forecast7d.status}
                q50Change={item.forecast7d.q50Change}
                isDemo={summary.forecastArtifact?.isDemo === true}
              />
            )}
          </p>
          <div className="flex flex-wrap gap-2">
            {view.showNumbers ? (
              <Button href={hrefs.forecast(commodity.code)} size="S" arrow>
                Lihat prediksi
              </Button>
            ) : null}
            <Button href="/peringatan" variant="secondary" size="S">
              Pantau (segera)
            </Button>
          </div>
        </div>
      </header>

      <FreshnessNotice
        latestObservedOn={latest?.observedOn ?? null}
        staleAtRender={item?.dataStatus === 'stale'}
      />

      <nav
        aria-label="Bagian halaman"
        className="sticky top-0 z-20 -mx-4 bg-canvas/95 px-4 py-2 backdrop-blur lg:top-[81px]"
      >
        <ul className="flex flex-wrap gap-1">
          {SECTIONS.map(([idAttr, label]) => (
            <li key={idAttr}>
              <a
                href={`#${idAttr}`}
                className="inline-flex min-h-11 items-center rounded-full px-4 text-[13px] font-bold text-ink-2 hover:bg-surface-2"
              >
                {label}
              </a>
            </li>
          ))}
        </ul>
      </nav>

      <section id="ringkasan" aria-label="Ringkasan perubahan" className="scroll-mt-32">
        <ul className="grid grid-cols-[repeat(auto-fit,minmax(min(100%,9.5rem),1fr))] gap-3">
          {([1, 7, 30, 90] as const).map((d) => {
            const c = changeWithReference(points365, d);
            return (
              <li key={d}>
                <MetricCard
                  label={`${String(d)} hari`}
                  value={<Delta value={c?.change ?? null} />}
                  caption={
                    c === null
                      ? 'Belum ada data pembanding'
                      : `vs ${formatDateWib(c.since, 'short')}`
                  }
                />
              </li>
            );
          })}
        </ul>
      </section>

      <section
        id="riwayat"
        className="min-w-0 scroll-mt-32 rounded-xl border border-line bg-surface p-5 sm:p-6"
      >
        <PriceChart
          id="detail-riwayat"
          title="Bagaimana harganya bergerak?"
          description={`${summary.market.name} · Rp/kg · observasi aktual`}
          points365={points365}
          pointsAll={pointsAll}
        />
      </section>

      <section
        id="prediksi"
        aria-labelledby="prediksi-title"
        className="grid scroll-mt-32 gap-6 lg:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]"
      >
        <div className="flex min-w-0 flex-col gap-4 rounded-xl border border-line bg-surface p-5 sm:p-6">
          <h2 id="prediksi-title" className="text-heading-title-20">
            Prediksi harga
          </h2>
          {view.showNumbers &&
          forecast.artifact !== null &&
          forecast.baseDate !== null &&
          forecast.basePriceIdr !== null ? (
            <>
              <ForecastChart
                id="detail-prediksi"
                actual={points365}
                baseDate={forecast.baseDate}
                basePriceIdr={forecast.basePriceIdr}
                horizons={forecast.horizons}
              />
              <PredictionMeta
                artifact={forecast.artifact}
                expired={forecast.status === 'expired'}
              />
              <Disclaimer />
            </>
          ) : (
            <SystemState
              kind={noForecastKind(forecast.status)}
              commodityName={commodity.name.toLowerCase()}
            />
          )}
        </div>
        <div className="flex flex-col gap-4">
          {tip === null ? null : <KataKapa pose={tip.pose} title={tip.title} body={tip.body} />}
          {view.showNumbers && h7 !== undefined ? (
            <section className="flex flex-col gap-2 rounded-xl bg-terong-100 p-5">
              <p className="text-overline-11 text-terong-600 uppercase">Prediksi 7 hari</p>
              <Price value={h7.q50PriceIdr} size="l" />
              <p className="text-body-small-13 text-ink-2">
                Perkiraan {formatDateWib(h7.targetDate, 'short')} · rentang{' '}
                {view.rows.find((r) => r.horizonDays === 7)?.range ?? '—'}
              </p>
              <Button href={hrefs.forecast(commodity.code)} variant="ghost" size="S" arrow>
                Semua horizon
              </Button>
            </section>
          ) : null}
        </div>
      </section>

      <div id="konteks" className="scroll-mt-32">
        <ContextSignals />
      </div>
    </PageContainer>
  );
}
