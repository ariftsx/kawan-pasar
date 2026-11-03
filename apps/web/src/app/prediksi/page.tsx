import { listCommodities, type Commodity } from '@kawan-pasar/catalog';
import { DemoBadge, MetricCard } from '@kawan-pasar/ui';

import { Kapa } from '@/components/brand/kapa';
import {
  Bullets,
  KataKapa,
  Overline,
  SegmentedLinks,
  StatusChip,
  Surface,
  TextLink,
  type ChipTone,
} from '@/components/kp/blocks';
import { PriceChart } from '@/components/kp/charts';
import { formatChangeArrow, formatMarketDate, formatRupiah } from '@/lib/format';
import { lastDays } from '@/lib/market/board';
import { param, withQuery } from '@/lib/market/route';
import { currentBoard } from '@/lib/market/server';
import {
  HORIZON_DAYS,
  horizonLabel,
  horizonShort,
  horizonStatus,
  parseHorizon,
  visiblePoint,
  type HorizonDay,
  type HorizonStatus,
  type Outlook,
} from '@/lib/outlook/schema';
import { getOutlook } from '@/lib/outlook/server';

import type { PricePoint } from '@/lib/market/demo-series';
import type { Metadata } from 'next';

export const metadata: Metadata = { title: 'Prediksi Harga' };

type Ready = Extract<Outlook, { kind: 'ready' }>;

const STATUS: Record<HorizonStatus, { label: string; tone: ChipTone }> = {
  tersedia: { label: 'Tersedia', tone: 'brand' },
  sebagian: { label: 'Sebagian teruji', tone: 'highlight' },
  'belum-diuji': { label: 'Belum diuji', tone: 'neutral' },
};

function Hero() {
  return (
    <section className="flex items-end justify-between gap-6 overflow-hidden rounded-3xl bg-accent-forecast-bg px-6 pt-8 md:px-10">
      <div className="flex max-w-2xl flex-col gap-3 pb-8">
        <Overline className="text-accent-forecast-fg">Prediksi ARIF-Net</Overline>
        <h1 className="text-3xl font-extrabold tracking-tight md:text-4xl">
          Perkiraan harga untuk beberapa hari ke depan
        </h1>
        <p className="text-lg text-text-secondary">
          Prediksi adalah estimasi berdasarkan pola data, bukan kepastian dan bukan saran membeli
          atau menjual.
        </p>
      </div>
      <Kapa pose="prediksi" className="hidden w-36 shrink-0 sm:block md:w-44" />
    </section>
  );
}

function Provenance({ outlook }: { readonly outlook: Ready }) {
  const rows = [
    ['Versi model', outlook.provenance.model_version],
    ['Versi dataset', outlook.provenance.dataset_version],
    ['Praproses', outlook.provenance.preprocessing_version],
    ['Batas data', formatMarketDate(outlook.provenance.data_cutoff)],
    ['Status artefak', outlook.provenance.artifact_status],
  ] as const;
  return (
    <Surface className="flex flex-col gap-4" aria-labelledby="info-title">
      <h2 id="info-title" className="text-xl font-extrabold">
        Info prediksi
      </h2>
      <dl className="grid grid-cols-1 gap-x-6 gap-y-3 md:grid-cols-2">
        {rows.map(([label, value]) => (
          <div key={label} className="flex flex-col">
            <dt className="text-sm text-text-muted">{label}</dt>
            <dd className="font-mono text-base break-all">{value}</dd>
          </div>
        ))}
      </dl>
    </Surface>
  );
}

function Filters({
  commodity,
  horizon,
  origin,
}: {
  readonly commodity: Commodity;
  readonly horizon: HorizonDay;
  readonly origin: string | null;
}) {
  return (
    <section aria-label="Pilihan prediksi" className="flex flex-col gap-4">
      <SegmentedLinks
        label="Komoditas"
        items={listCommodities().map((item) => ({
          href: withQuery('/prediksi', { komoditas: item.slug, horizon: String(horizon) }),
          label: item.forecast === 'available' ? item.name : `${item.name} (menyusul)`,
          isActive: item.slug === commodity.slug,
        }))}
      />
      <div className="flex flex-wrap items-center gap-3">
        <StatusChip tone="outline">Pasar Kramat Jati</StatusChip>
        {origin === null ? null : (
          <StatusChip tone="outline">Hari dasar {formatMarketDate(origin)}</StatusChip>
        )}
        <SegmentedLinks
          label="Horizon"
          items={HORIZON_DAYS.map((h) => ({
            href: withQuery('/prediksi', { komoditas: commodity.slug, horizon: String(h) }),
            label: horizonShort(h),
            isActive: h === horizon,
          }))}
        />
      </div>
    </section>
  );
}

function Metrics({ outlook, horizon }: { readonly outlook: Ready; readonly horizon: HorizonDay }) {
  const point = visiblePoint(outlook.points, horizon);
  return (
    <ul className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-4">
      <li>
        <MetricCard
          label="Harga acuan"
          value={formatRupiah(outlook.referencePrice)}
          caption={`Harga pada ${formatMarketDate(outlook.origin)}`}
          badge={outlook.isDemo ? <DemoBadge /> : undefined}
        />
      </li>
      <li>
        <MetricCard
          label={`Perkiraan ${horizonLabel(horizon)}`}
          value={point === null ? null : formatRupiah(point.predicted_price_idr)}
          emptyLabel="Belum diuji"
          caption={
            point === null ? 'Horizon ini belum bisa diuji' : formatMarketDate(point.target_date)
          }
        />
      </li>
      <li>
        <MetricCard
          label="Perubahan"
          value={point === null ? null : formatChangeArrow(point.predicted_change)}
          emptyLabel="—"
          caption="dibanding harga acuan"
        />
      </li>
      <li>
        <MetricCard
          label="Rentang perkiraan"
          value={null}
          emptyLabel="—"
          caption="Rentang belum diterbitkan model"
        />
      </li>
    </ul>
  );
}

function ForecastChart({
  outlook,
  horizon,
  name,
  history,
}: {
  readonly outlook: Ready;
  readonly horizon: HorizonDay;
  readonly name: string;
  readonly history: readonly PricePoint[];
}) {
  const point = visiblePoint(outlook.points, horizon);
  const shown = outlook.points
    .filter(
      (item) => item.horizon_day <= horizon && horizonStatus(item.horizon_day) !== 'belum-diuji',
    )
    .map((item) => ({ date: item.target_date, price: item.predicted_price_idr }));
  const forecast =
    shown.length === 0
      ? {}
      : {
          forecast: {
            points: shown,
            ...(point === null ? {} : { focusDate: point.target_date }),
          },
        };
  return (
    <Surface className="flex flex-col gap-4" aria-labelledby="grafik-title">
      <h2 id="grafik-title" className="text-xl font-extrabold">
        Harga teramati dan perkiraan
      </h2>
      <PriceChart
        title={`Prediksi ${name} ${horizonLabel(horizon)}`}
        observed={lastDays(history, 60)}
        {...forecast}
      />
    </Surface>
  );
}

function HorizonRow({
  outlook,
  day,
  horizon,
}: {
  readonly outlook: Ready;
  readonly day: HorizonDay;
  readonly horizon: HorizonDay;
}) {
  const item = visiblePoint(outlook.points, day);
  const status = STATUS[horizonStatus(day)];
  return (
    <tr aria-current={day === horizon ? 'true' : undefined}>
      <th scope="row" className="py-3 pr-4 font-semibold">
        {horizonLabel(day)}
      </th>
      <td className="py-3 pr-4">{item === null ? '—' : formatMarketDate(item.target_date)}</td>
      <td className="py-3 pr-4 font-mono">
        {item === null ? '—' : formatRupiah(item.predicted_price_idr)}
      </td>
      <td className="py-3 pr-4 font-mono">
        {item === null ? '—' : formatChangeArrow(item.predicted_change)}
      </td>
      <td className="py-3">
        <StatusChip tone={status.tone}>{status.label}</StatusChip>
      </td>
    </tr>
  );
}

function HorizonTable({
  outlook,
  horizon,
}: {
  readonly outlook: Ready;
  readonly horizon: HorizonDay;
}) {
  return (
    <Surface className="flex flex-col gap-4" aria-labelledby="horizon-title">
      <h2 id="horizon-title" className="text-xl font-extrabold">
        Semua horizon
      </h2>
      <div
        className="overflow-x-auto"
        tabIndex={0}
        role="region"
        aria-label="Tabel horizon, geser ke samping"
      >
        <table className="w-full min-w-xl text-left">
          <caption className="sr-only">Prediksi per horizon</caption>
          <thead className="text-sm text-text-muted">
            <tr>
              {['Horizon', 'Tanggal', 'Perkiraan', 'Perubahan', 'Status'].map((label) => (
                <th key={label} scope="col" className="py-2 pr-4 font-semibold">
                  {label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-border-default">
            {HORIZON_DAYS.map((day) => (
              <HorizonRow key={day} outlook={outlook} day={day} horizon={horizon} />
            ))}
          </tbody>
        </table>
      </div>
    </Surface>
  );
}

function Limitations({ items }: { readonly items: readonly string[] }) {
  return (
    <Surface className="flex flex-col gap-3" aria-labelledby="batas-title">
      <h2 id="batas-title" className="text-xl font-extrabold">
        Keterbatasan
      </h2>
      <Bullets items={items.length > 0 ? items : ['Model belum memuat rentang ketidakpastian.']} />
      <TextLink href="/arif-net/keterbatasan">Semua keterbatasan</TextLink>
    </Surface>
  );
}

function NotModeled({ commodity }: { readonly commodity: Commodity }) {
  return (
    <Surface className="flex flex-col gap-2">
      <h2 className="text-xl font-extrabold">Prediksi {commodity.name} menyusul</h2>
      <p className="text-base text-text-secondary">
        ARIF-Net saat ini memprediksi cabai merah keriting, bawang merah, dan beras medium. Harga
        hari ini untuk komoditas ini tetap bisa dipantau.
      </p>
      <TextLink href={withQuery(`/harga/${commodity.slug}`, {})}>
        Lihat harga {commodity.name}
      </TextLink>
    </Surface>
  );
}

function LoadFailed({ requestId }: { readonly requestId: string | null }) {
  return (
    <Surface className="flex flex-col gap-2" aria-labelledby="gagal-title">
      <h2 id="gagal-title" className="text-xl font-extrabold">
        Prediksi gagal dimuat
      </h2>
      <p className="text-base text-text-secondary">
        Layanan prediksi sedang tidak dapat dihubungi. Coba muat ulang halaman beberapa saat lagi.
      </p>
      {requestId === null ? null : (
        <p className="font-mono text-sm text-text-muted">Kode: {requestId}</p>
      )}
    </Surface>
  );
}

export default async function PrediksiPage({
  searchParams,
}: {
  readonly searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const query = await searchParams;
  const commodities = listCommodities();
  const commodity =
    commodities.find((item) => item.slug === param(query.komoditas)) ?? commodities[0];
  if (commodity === undefined) return null;
  const horizon = parseHorizon(param(query.horizon));
  const outlook = commodity.forecast === 'available' ? await getOutlook(commodity.slug) : null;
  const history =
    currentBoard().rows.find((item) => item.commodity.slug === commodity.slug)?.history ?? [];
  return (
    <div className="flex flex-col gap-8">
      <Hero />
      <Filters
        commodity={commodity}
        horizon={horizon}
        origin={outlook?.kind === 'ready' ? outlook.origin : null}
      />
      {outlook === null ? <NotModeled commodity={commodity} /> : null}
      {outlook?.kind === 'unavailable' ? <LoadFailed requestId={outlook.requestId} /> : null}
      {outlook?.kind === 'ready' ? (
        <>
          <Metrics outlook={outlook} horizon={horizon} />
          <ForecastChart
            outlook={outlook}
            horizon={horizon}
            name={commodity.name}
            history={history}
          />
          <HorizonTable outlook={outlook} horizon={horizon} />
          <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
            <Provenance outlook={outlook} />
            <Limitations items={outlook.limitations} />
          </div>
        </>
      ) : null}
      <KataKapa
        pose="prediksi"
        title="Horizon makin jauh, ketidakpastian makin besar."
        link={{ href: '/arif-net', label: 'Kenalan dengan ARIF-Net' }}
      >
        Horizon 180 hari dan 1 tahun belum bisa diuji secara prospektif, jadi nilainya belum
        ditampilkan.
      </KataKapa>
    </div>
  );
}
