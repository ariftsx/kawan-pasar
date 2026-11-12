import { COMMODITIES, HORIZONS } from '@kawan-pasar/catalog';
import type { Commodity } from '@kawan-pasar/catalog';
import type { ForecastResponse, PricePoint } from '@kawan-pasar/contracts';
import Link from 'next/link';
import type { ReactNode } from 'react';
import { FeatureIcon } from '@/brand/FeatureIcon';
import { Kapa } from '@/brand/Kapa';
import { KapaMotion } from '@/brand/KapaMotion';
import { cx } from '@/lib/cx';
import { formatDateWib, formatHorizon, formatRupiah } from '@/lib/format';
import { hrefs } from '@/lib/hrefs';
import { forecastView } from '@/lib/insights/forecast-view';
import type { ForecastRow } from '@/lib/insights/forecast-view';
import { Button } from '../atoms/Button';
import { Disclaimer } from '../atoms/Disclaimer';
import { ForecastChart } from '../charts/ForecastChart';
import { Switch } from '../charts/Switch';
import { KataKapa } from '../molecules/KataKapa';
import { MetricCard } from '../molecules/MetricCard';
import { PredictionMeta } from '../organisms/PredictionMeta';
import { SystemState } from '../organisms/SystemState';
import { PageContainer } from './SiteShell';

const PANEL = 'prediksi-panel';

function CommodityPicker({ active }: { active: Commodity }): ReactNode {
  return (
    <nav aria-label="Pilih komoditas" data-picker-fallback>
      <p className="mb-1.5 text-overline-11 text-muted-text uppercase">Komoditas</p>
      <ul className="flex flex-wrap gap-2">
        {COMMODITIES.map((c) =>
          c.modelCoverage === 'covered' ? (
            <li key={c.code}>
              <Link
                href={hrefs.forecast(c.code)}
                aria-current={c.code === active.code ? 'page' : undefined}
                className={cx(
                  'inline-flex min-h-11 items-center rounded-full border px-4 text-sm font-semibold',
                  c.code === active.code
                    ? 'border-green-900 bg-green-900 text-surface'
                    : 'border-line bg-surface text-ink hover:bg-surface-2',
                )}
              >
                {c.name}
              </Link>
            </li>
          ) : (
            <li key={c.code}>
              <span className="inline-flex min-h-11 items-center gap-1.5 rounded-full border border-dashed border-line px-4 text-sm text-muted-text">
                {c.name} · menyusul
              </span>
            </li>
          ),
        )}
      </ul>
    </nav>
  );
}

function HorizonCards({
  row,
  basePriceIdr,
}: {
  row: ForecastRow;
  basePriceIdr: number;
}): ReactNode {
  return (
    <div data-horizon-only={String(row.horizonDays)} className="mb-5">
      <ul className="grid grid-cols-[repeat(auto-fit,minmax(min(100%,9.5rem),1fr))] gap-3">
        <li>
          <MetricCard
            label="Harga acuan"
            value={
              <span className="tabular font-mono text-numeric-m-24 font-semibold">
                {formatRupiah(basePriceIdr)}
              </span>
            }
            caption="harga pada hari dasar"
          />
        </li>
        <li>
          <MetricCard
            label="Perkiraan perubahan"
            value={
              <span className="tabular font-mono text-numeric-m-24 font-semibold">
                {row.direction === 'up' ? '↑ ' : row.direction === 'down' ? '↓ ' : ''}
                {row.change}
              </span>
            }
            caption={`estimasi · ${row.label}`}
          />
        </li>
        <li>
          <MetricCard
            label="Perkiraan harga"
            value={
              <span className="tabular font-mono text-numeric-m-24 font-semibold">{row.price}</span>
            }
            caption={`target ${row.target}`}
          />
        </li>
        <li>
          <MetricCard
            label="Rentang kemungkinan"
            value={
              <span className="tabular font-mono text-numeric-m-24 font-semibold">
                {row.rangeCompact}
              </span>
            }
            caption="kemungkinan 80%"
          />
        </li>
      </ul>
    </div>
  );
}

/**
 * Forecast page (v0.4 "Prediksi harga hingga 1 tahun"): the 8 horizons are rendered on the
 * server; the horizon pills only switch which set is highlighted.
 */
export function ForecastPage({
  commodity,
  forecast,
  actual,
}: {
  commodity: Commodity;
  forecast: ForecastResponse;
  actual: readonly PricePoint[];
}): ReactNode {
  const view = forecastView(forecast);
  const ready =
    view.showNumbers &&
    forecast.artifact !== null &&
    forecast.baseDate !== null &&
    forecast.basePriceIdr !== null;

  return (
    <PageContainer className="flex flex-col gap-8 py-6 lg:py-10">
      <section className="flex flex-col items-center gap-6 rounded-2xl bg-terong-100 p-6 sm:flex-row sm:p-10">
        <div className="flex min-w-0 flex-1 flex-col gap-3">
          <p className="text-overline-11 text-terong-600 uppercase">Prediksi ★ · ARIF-Net</p>
          <h1 className="text-heading-h2-32 lg:text-heading-h1-40 text-balance">
            Prediksi harga hingga 1 tahun
          </h1>
          <p className="text-body-medium-15 max-w-2xl text-ink-2">
            Perkiraan pergerakan harga komoditas untuk 1 hari sampai 1 tahun ke depan. Gunakan
            sebagai gambaran anggaran belanja, bukan jaminan harga.
          </p>
        </div>
        <KapaMotion>
          <Kapa pose="prediksi" size={120} />
        </KapaMotion>
      </section>

      <div className="flex flex-col gap-4">
        <CommodityPicker active={commodity} />
        <dl className="flex flex-wrap gap-x-8 gap-y-2 text-sm">
          <div>
            <dt className="text-overline-11 text-muted-text uppercase">Pasar</dt>
            <dd className="font-semibold">{forecast.market.name}</dd>
          </div>
          <div>
            <dt className="text-overline-11 text-muted-text uppercase">Hari dasar</dt>
            <dd className="font-semibold">
              {forecast.baseDate === null ? '—' : formatDateWib(forecast.baseDate, 'long')}
            </dd>
          </div>
        </dl>
        {ready ? (
          <Switch
            targetId={PANEL}
            name="horizon"
            label="Horizon prediksi"
            defaultValue="7"
            options={HORIZONS.map((d) => ({
              value: String(d),
              short: formatHorizon(d).short,
              long: formatHorizon(d).long,
            }))}
          />
        ) : null}
      </div>

      {forecast.status === 'expired' ? (
        <p
          role="status"
          className="rounded-md border border-kunyit-500 bg-kunyit-100 px-4 py-3 text-body-small-13"
        >
          <strong>Prediksi kedaluwarsa.</strong> Bundel prediksi ini sudah lebih dari 8 hari; angka
          di bawah hanya sebagai gambaran sampai prediksi baru terbit.
        </p>
      ) : null}

      {ready &&
      forecast.artifact !== null &&
      forecast.baseDate !== null &&
      forecast.basePriceIdr !== null ? (
        <div className="grid gap-6 lg:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]">
          <section
            aria-labelledby="grafik-title"
            className="min-w-0 rounded-xl border border-line bg-surface p-5 sm:p-6"
          >
            <h2 id="grafik-title" className="mb-1 text-heading-title-20">
              Grafik prediksi · {commodity.name}
            </h2>
            <p className="mb-4 text-body-small-13 text-muted-text">
              Harga aktual 60 hari + prediksi per horizon · Rp/kg · {forecast.market.name}
            </p>
            <ForecastChart
              id={PANEL}
              actual={actual}
              baseDate={forecast.baseDate}
              basePriceIdr={forecast.basePriceIdr}
              horizons={forecast.horizons}
              before={view.rows.map((r) => (
                <HorizonCards
                  key={r.horizonDays}
                  row={r}
                  basePriceIdr={forecast.basePriceIdr ?? 0}
                />
              ))}
              table="open"
            />
          </section>
          <aside className="flex flex-col gap-4">
            <section
              aria-labelledby="info-title"
              className="flex flex-col gap-3 rounded-xl border border-line bg-surface p-5"
            >
              <h2 id="info-title" className="flex items-center gap-2 text-heading-card-16">
                <FeatureIcon name="info" /> Info prediksi
              </h2>
              <dl className="grid grid-cols-[auto_minmax(0,1fr)] gap-x-4 gap-y-1.5 text-body-small-13">
                <dt className="text-ink-2">Hari dasar</dt>
                <dd className="text-right font-semibold">
                  {formatDateWib(forecast.baseDate, 'short')}
                </dd>
                <dt className="text-ink-2">Model</dt>
                <dd className="text-right font-semibold">{forecast.artifact.modelName}</dd>
                <dt className="text-ink-2">Versi</dt>
                <dd className="text-right font-mono text-[12px] break-all">
                  {forecast.artifact.modelVersion}
                </dd>
                <dt className="text-ink-2">Data sampai</dt>
                <dd className="text-right font-semibold">
                  {formatDateWib(forecast.artifact.dataCutoff, 'short')}
                </dd>
                <dt className="text-ink-2">Terbit</dt>
                <dd className="text-right font-semibold">
                  {formatDateWib(forecast.artifact.issuedAt, 'short')}
                </dd>
                <dt className="text-ink-2">Pasar</dt>
                <dd className="text-right font-semibold">{forecast.market.name}</dd>
              </dl>
              <PredictionMeta
                artifact={forecast.artifact}
                expired={forecast.status === 'expired'}
              />
              <Button href="/arif-net" variant="ghost" size="S" arrow className="self-start">
                Bagaimana prediksi dibuat?
              </Button>
            </section>
            <KataKapa
              pose="belajar"
              title="Garis putus-putus = perkiraan."
              body="Area ungu muda menunjukkan rentang kemungkinan harga. Makin jauh horizonnya, makin lebar rentangnya."
              action={
                <Button href="/edukasi" variant="ghost" size="S" arrow>
                  Cara membaca prediksi
                </Button>
              }
            />
            <section
              aria-labelledby="batas-title"
              className="flex flex-col gap-2 rounded-xl bg-surface-2 p-5"
            >
              <h2 id="batas-title" className="text-heading-card-16">
                Keterbatasan
              </h2>
              <ul className="list-disc space-y-1 pl-5 text-body-small-13 text-ink-2">
                <li>Bukan jaminan harga dan bukan rekomendasi jual/beli.</li>
                <li>Horizon panjang belum semuanya bisa diuji secara prospektif.</li>
                <li>Saat ini hanya 3 komoditas di {forecast.market.name}.</li>
              </ul>
              <Button
                href="/arif-net/keterbatasan"
                variant="ghost"
                size="S"
                arrow
                className="self-start"
              >
                Baca keterbatasan
              </Button>
            </section>
          </aside>
        </div>
      ) : forecast.status === 'pending_coverage' ? (
        <SystemState kind="forecast_pending" commodityName={commodity.name.toLowerCase()} />
      ) : (
        <SystemState kind="forecast_unavailable" commodityName={commodity.name.toLowerCase()} />
      )}
      <Disclaimer />
    </PageContainer>
  );
}
