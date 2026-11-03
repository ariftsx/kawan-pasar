import { listCommodities } from '@kawan-pasar/catalog';
import { ButtonLink, DemoBadge } from '@kawan-pasar/ui';
import Link from 'next/link';

import { FeatureIcon } from '@/components/brand/feature-icon';
import { Illustration, type IllustrationName } from '@/components/brand/illustration';
import { Kapa } from '@/components/brand/kapa';
import {
  ChangeTag,
  FOCUS,
  KataKapa,
  Overline,
  SectionHeader,
  StatusChip,
  Surface,
  TextLink,
} from '@/components/kp/blocks';
import { PriceChart } from '@/components/kp/charts';
import { CommodityCard, CommodityTile } from '@/components/kp/commodity';
import { formatChangeArrow, formatRupiah, formatWeekdayDate } from '@/lib/format';
import { highlights, lastDays, type BoardRow } from '@/lib/market/board';
import { currentBoard, forecastOutlooks, isDemoMode } from '@/lib/market/server';
import { visiblePoint, type Outlook } from '@/lib/outlook/schema';

import type { Route } from 'next';

function Hero({ asOf, isDemo }: { readonly asOf: string | null; readonly isDemo: boolean }) {
  return (
    <section className="grid grid-cols-1 items-center gap-8 overflow-hidden rounded-3xl bg-accent-brand-strong px-6 pt-8 text-accent-on-brand-strong md:grid-cols-2 md:px-12 md:pt-12">
      <div className="flex flex-col gap-5 pb-2 md:pb-12">
        <div className="flex flex-wrap gap-2">
          {asOf === null ? null : (
            <StatusChip tone="outline" className="border-current/30 text-accent-on-brand-strong">
              Data {formatWeekdayDate(asOf)}
            </StatusChip>
          )}
          {isDemo ? <DemoBadge /> : null}
        </div>
        <h1 className="text-4xl font-extrabold tracking-tight md:text-5xl">
          Cek harga dulu, belanja lebih tenang.
        </h1>
        <p className="max-w-xl text-lg">
          Harga harian 5 komoditas pokok di Pasar Kramat Jati, lengkap dengan prediksi ARIF-Net
          untuk beberapa hari ke depan, sebagai gambaran pengeluaran sebelum ke pasar.
        </p>
        <div className="flex flex-col gap-3 md:flex-row">
          <ButtonLink href="/harga" size="lg" variant="highlight">
            Lihat harga hari ini
          </ButtonLink>
          <ButtonLink href="/arif-net" size="lg" variant="secondary">
            Kenali ARIF-Net
          </ButtonLink>
        </div>
      </div>
      <div className="relative flex items-end justify-center">
        <Illustration name="lapak" className="w-full max-w-md" />
        <Kapa
          pose="halo"
          isAnimated
          title="Kapa melambai"
          className="absolute bottom-0 left-0 w-28 md:w-36"
        />
        <p className="absolute top-4 left-24 max-w-56 rounded-2xl rounded-bl-sm bg-bg-surface p-3 text-sm text-text-primary shadow-2 md:left-32">
          <strong>Hai, aku Kapa!</strong> Aku bantu kamu membaca harga dan prediksinya.
        </p>
      </div>
    </section>
  );
}

function Stat({
  overline,
  row,
  caption,
  emptyText,
}: {
  readonly overline: string;
  readonly row: BoardRow | null;
  readonly caption: string;
  readonly emptyText: string;
}) {
  return (
    <Surface className="flex flex-1 flex-col gap-3">
      <Overline>{overline}</Overline>
      {row === null ? (
        <p className="text-base text-text-secondary">{emptyText}</p>
      ) : (
        <>
          <p className="flex items-center gap-3">
            <CommodityTile slug={row.commodity.slug} className="size-10" />
            <span className="text-base font-bold">{row.commodity.name}</span>
          </p>
          <p className="flex items-center gap-3">
            <span className="font-mono text-2xl font-semibold">{formatRupiah(row.price)}</span>
            <ChangeTag ratio={row.change7} />
          </p>
          <p className="text-sm text-text-secondary">
            Per kg · {caption} {formatRupiah(row.delta7 === null ? null : Math.abs(row.delta7))}{' '}
            dibanding 7 hari lalu.
          </p>
        </>
      )}
    </Surface>
  );
}

function ForecastStat({ outlooks }: { readonly outlooks: ReadonlyMap<string, Outlook> }) {
  const changes = [...outlooks.values()].flatMap((outlook) => {
    if (outlook.kind !== 'ready') return [];
    const point = visiblePoint(outlook.points, 7);
    return point === null ? [] : [point.predicted_change];
  });
  const up = changes.filter((change) => change > 0.005).length;
  return (
    <Surface className="flex flex-1 flex-col gap-3">
      <Overline className="text-accent-forecast-fg">Prediksi 7 hari · ARIF-Net</Overline>
      <p className="flex items-center gap-3">
        <span className="flex size-10 items-center justify-center rounded-2xl bg-accent-forecast-bg">
          <FeatureIcon name="prediksi" />
        </span>
        <span className="text-base font-bold">3 komoditas diprediksi</span>
      </p>
      {changes.length === 0 ? (
        <p className="text-sm text-text-secondary">
          Prediksi sedang tidak dapat dimuat. Harga hari ini tetap tersedia.
        </p>
      ) : (
        <>
          <p className="font-mono text-2xl font-semibold">{`${String(up)} naik`}</p>
          <p className="text-sm text-text-secondary">
            Dari {changes.length} komoditas yang diprediksi, {up} diperkirakan naik dalam 7 hari.
            Estimasi, bukan jaminan harga.
          </p>
        </>
      )}
    </Surface>
  );
}

function ForecastPreview({
  row,
  outlook,
}: {
  readonly row: BoardRow | undefined;
  readonly outlook: Outlook | undefined;
}) {
  const point = outlook?.kind === 'ready' ? visiblePoint(outlook.points, 7) : null;
  return (
    <Surface className="flex flex-col gap-4" aria-labelledby="pratinjau-title">
      <div className="flex items-center gap-3">
        <span className="flex size-11 items-center justify-center rounded-2xl bg-accent-forecast-bg">
          <FeatureIcon name="prediksi" />
        </span>
        <div>
          <h2 id="pratinjau-title" className="text-xl font-extrabold">
            Prediksi ARIF-Net
          </h2>
          <p className="text-sm text-text-secondary">Cabai merah keriting · Pasar Kramat Jati</p>
        </div>
      </div>
      {row === undefined || row.history.length === 0 ? (
        <p className="text-base text-text-secondary">Riwayat harga belum tersedia.</p>
      ) : (
        <PriceChart
          title="Harga cabai merah keriting 60 hari terakhir dan prediksi 7 hari"
          observed={lastDays(row.history, 60)}
          {...(point === null || outlook?.kind !== 'ready'
            ? {}
            : {
                forecast: {
                  points: [{ date: point.target_date, price: point.predicted_price_idr }],
                  focusDate: point.target_date,
                },
              })}
        />
      )}
      <p className="text-base">
        {point === null ? (
          'Prediksi sedang tidak dapat dimuat.'
        ) : (
          <>
            Perkiraan 7 hari:{' '}
            <strong className="font-mono">{formatRupiah(point.predicted_price_idr)}</strong> (
            {formatChangeArrow(point.predicted_change)}).
          </>
        )}
      </p>
      <TextLink href="/prediksi">Buka halaman prediksi</TextLink>
    </Surface>
  );
}

const EDU: readonly {
  art: IllustrationName | 'kapa';
  tag: string;
  title: string;
  body: string;
  href: Route;
}[] = [
  {
    art: 'inflasi',
    tag: 'Dasar · 5 menit',
    title: 'Apa itu inflasi pangan?',
    body: 'Kenapa cabai dan bawang mudah naik turun, dan apa dampaknya ke pengeluaran dapur.',
    href: '/edukasi/inflasi-pangan',
  },
  {
    art: 'kapa',
    tag: 'Dasar · 3 menit',
    title: 'Cara membaca prediksi harga',
    body: 'Arti hari dasar, horizon 1 hari sampai 1 tahun, dan batas data teramati.',
    href: '/edukasi',
  },
  {
    art: 'arif-net',
    tag: 'ARIF-Net · 4 menit',
    title: 'Kenalan dengan ARIF-Net',
    body: 'Model prediksi Kawan Pasar: membaca riwayat harga, pola musiman, dan lonjakan.',
    href: '/arif-net',
  },
];

export default async function BerandaPage() {
  const board = currentBoard();
  const outlooks = await forecastOutlooks();
  const isDemo = isDemoMode();
  const { up, down } = highlights(board.rows);
  const cabai = board.rows.find((row) => row.commodity.slug === 'cabai-merah-keriting');
  const forecastable = listCommodities().filter((item) => item.forecast === 'available').length;
  return (
    <div className="flex flex-col gap-12">
      <Hero asOf={board.status === 'demo' ? board.asOf : null} isDemo={isDemo} />

      <section aria-label="Sorotan minggu ini" className="flex flex-col gap-4 md:flex-row">
        <Stat
          overline="Paling naik minggu ini"
          row={up}
          caption="naik"
          emptyText={
            board.status === 'demo'
              ? 'Tidak ada komoditas yang naik minggu ini.'
              : 'Belum ada data harga.'
          }
        />
        <Stat
          overline="Paling turun minggu ini"
          row={down}
          caption="turun"
          emptyText={
            board.status === 'demo'
              ? 'Tidak ada komoditas yang turun minggu ini.'
              : 'Belum ada data harga.'
          }
        />
        <ForecastStat outlooks={outlooks} />
      </section>

      <section aria-labelledby="harga-title" className="flex flex-col gap-5">
        <SectionHeader
          id="harga-title"
          title="Harga hari ini"
          description={`Pasar Kramat Jati · per kg · sumber PIHPS · ${String(forecastable)} dari 5 komoditas bisa diprediksi`}
          link={{ href: '/harga', label: 'Lihat tabel harga' }}
        />
        {board.status === 'unavailable' ? (
          <Surface>
            <p className="text-base text-text-secondary">
              Harga harian belum tersedia. Pengambilan data PIHPS sedang disiapkan.
            </p>
          </Surface>
        ) : (
          <ul className="grid grid-cols-1 gap-4 md:grid-cols-3 lg:grid-cols-5">
            {board.rows.map((row) => (
              <li key={row.commodity.slug} className="flex">
                <CommodityCard row={row} />
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="grid grid-cols-1 gap-5 lg:grid-cols-3">
        <div className="lg:col-span-2">
          <ForecastPreview row={cabai} outlook={outlooks.get('cabai-merah-keriting')} />
        </div>
        <KataKapa
          pose="menunjuk"
          title="Menjelang akhir tahun, harga cabai sering bergerak lebih besar."
          link={{ href: '/edukasi/inflasi-pangan', label: 'Pelajari pola musiman' }}
        >
          Pola ini terlihat di riwayat harga beberapa tahun terakhir. Prediksi adalah perkiraan,
          bukan jaminan harga.
        </KataKapa>
      </section>

      <section aria-labelledby="edukasi-title" className="flex flex-col gap-5">
        <SectionHeader
          id="edukasi-title"
          title="Belajar sambil belanja"
          description="Pahami inflasi pangan dan cara membaca prediksi, dalam 5 menit."
          link={{ href: '/edukasi', label: 'Semua topik edukasi' }}
        />
        <ul className="grid grid-cols-1 gap-5 md:grid-cols-3">
          {EDU.map((item) => (
            <li key={item.title} className="flex">
              <Link
                href={item.href}
                className={`flex flex-1 flex-col overflow-hidden rounded-3xl border border-border-default bg-bg-surface ${FOCUS}`}
              >
                <span className="flex h-44 items-center justify-center bg-bg-subtle">
                  {item.art === 'kapa' ? (
                    <Kapa pose="belajar" className="h-36 w-auto" />
                  ) : (
                    <Illustration name={item.art} className="h-36 w-auto" />
                  )}
                </span>
                <span className="flex flex-col gap-2 p-6">
                  <StatusChip tone="highlight" className="self-start">
                    {item.tag}
                  </StatusChip>
                  <span className="text-lg font-extrabold">{item.title}</span>
                  <span className="text-sm text-text-secondary">{item.body}</span>
                </span>
              </Link>
            </li>
          ))}
        </ul>
      </section>

      <section
        aria-labelledby="cakupan-title"
        className="grid overflow-hidden rounded-3xl border border-border-default bg-bg-surface md:grid-cols-2"
      >
        <div className="flex items-center justify-center bg-bg-brand-subtle p-6">
          <Illustration name="peta" className="w-full max-w-sm" />
        </div>
        <div className="flex flex-col gap-4 p-8">
          <StatusChip tone="chili" className="self-start">
            Cakupan data
          </StatusChip>
          <h2 id="cakupan-title" className="text-2xl font-extrabold">
            Sekarang di Pasar Kramat Jati. Pasar dan wilayah lain menyusul.
          </h2>
          <p className="text-base text-text-secondary">
            Harga tiap daerah berbeda. Tahap awal memakai data Pasar Kramat Jati dengan 3 komoditas
            yang bisa diprediksi. Pasar dan wilayah lain, serta prediksi cabai rawit, sedang
            dikembangkan.
          </p>
          <ul className="flex flex-wrap gap-2">
            <li>
              <StatusChip tone="brand">● Pasar Kramat Jati · tersedia</StatusChip>
            </li>
            <li>
              <StatusChip tone="outline">Pasar/wilayah lain · segera</StatusChip>
            </li>
            <li>
              <StatusChip tone="outline">Prediksi cabai rawit · segera</StatusChip>
            </li>
          </ul>
        </div>
      </section>
    </div>
  );
}
