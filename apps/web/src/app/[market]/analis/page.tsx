import type { CommodityCode, MarketCode } from '@kawan-pasar/catalog';
import { COMMODITIES, MARKETS } from '@kawan-pasar/catalog';
import type { Metadata } from 'next';
import type { ReactNode } from 'react';
import { Disclaimer } from '@/components/atoms/Disclaimer';
import { AnalystExplorer } from '@/components/organisms/analyst/AnalystExplorer';
import type { ExplorerSeries } from '@/components/organisms/analyst/AnalystExplorer';
import { SystemState } from '@/components/organisms/SystemState';
import { PageContainer } from '@/components/templates/SiteShell';
import { encodeSeries, mergeHistory } from '@/lib/analyst/series';
import { api } from '@/lib/api/endpoints';
import { formatDateWib, formatHorizon, formatRupiah } from '@/lib/format';
import { forecastView } from '@/lib/insights/forecast-view';
import { marketFrom } from '@/lib/page-params';
import { accountHrefs, hrefs } from '@/lib/hrefs';
import { pageMetadata } from '@/lib/seo';

export const revalidate = 600;
export const dynamicParams = true;
export function generateStaticParams(): { market: string }[] {
  return [];
}

export const metadata: Metadata = pageMetadata({
  title: 'Mode Analis',
  description:
    'Bandingkan riwayat harga komoditas pangan Pasar Kramat Jati dan unduh data harga serta prediksi dalam CSV.',
  path: '/analis',
});

const COLORS: ExplorerSeries['color'][] = [
  'chili-600',
  'terong-600',
  'green-600',
  'shallot-500',
  'kunyit-500',
];

interface Loaded {
  series: ExplorerSeries;
  first: string;
  last: string;
  lastPrice: number;
}

/** Horizons shown in the comparison table (the full set is on each Prediksi page). */
const TABLE_HORIZONS = [7, 30, 90, 365] as const;

async function seriesOf(
  market: MarketCode,
  code: CommodityCode,
  name: string,
  i: number,
): Promise<Loaded | null> {
  const [all, year] = await Promise.all([
    api.history(market, code, 'all'),
    api.history(market, code, '365d'),
  ]);
  if (!all.ok || !year.ok) return null;
  const points = mergeHistory(all.data.points, year.data.points);
  const last = points.at(-1);
  if (last === undefined) return null;
  return {
    series: {
      code,
      name,
      color: COLORS[i % COLORS.length] ?? 'chili-600',
      points: encodeSeries(points),
    },
    first: points[0]?.day ?? last.day,
    last: last.day,
    lastPrice: last.price,
  };
}

/** Mode Analis (Fase 3A, prototype d_analis): public comparison, CSV for the Analyst role. */
export default async function Analis({
  params,
}: {
  params: Promise<{ market: string }>;
}): Promise<ReactNode> {
  const market = await marketFrom(params);
  const marketName = MARKETS.find((m) => m.code === market)?.name ?? market;
  const [loadedAll, forecasts] = await Promise.all([
    Promise.all(COMMODITIES.map((c, i) => seriesOf(market, c.code, c.name, i))),
    Promise.all(COMMODITIES.map((c) => api.forecast(market, c.code))),
  ]);
  const loaded = loadedAll.filter((s) => s !== null);
  const forecastRows = COMMODITIES.map((c, i) => {
    const f = forecasts[i];
    const view = f?.ok === true ? forecastView(f.data) : null;
    return {
      code: c.code,
      name: c.name,
      labels: view?.labels ?? [],
      cells: TABLE_HORIZONS.map((h) => view?.rows.find((r) => r.horizonDays === h) ?? null),
    };
  });
  const series = loaded.map((s) => s.series);
  const latest = loaded
    .map((s) => s.last)
    .sort()
    .at(-1);

  return (
    <PageContainer className="flex flex-col gap-10 py-6 lg:py-10">
      <header className="flex flex-col gap-3">
        <p className="text-overline-11 text-muted-text uppercase">Mode Analis · {marketName}</p>
        <h1 className="text-heading-h2-32 lg:text-heading-h1-40 text-balance">
          Bandingkan harga antarkomoditas.
        </h1>
        <p className="text-body-medium-15 max-w-2xl text-ink-2">
          Lihat beberapa komoditas sekaligus dalam satu grafik. Pilih indeks agar komoditas dengan
          harga berbeda jauh bisa dibandingkan dari titik awal yang sama.
        </p>
      </header>

      <section
        aria-labelledby="grafik"
        className="flex flex-col gap-4 rounded-2xl border border-line bg-surface p-4 sm:p-6"
      >
        <h2 id="grafik" className="text-heading-title-20">
          Grafik perbandingan
        </h2>
        {series.length === 0 || latest === undefined ? (
          <SystemState kind="load_failed" />
        ) : (
          <>
            <AnalystExplorer series={series} latest={latest} />
            <p className="text-body-small-13 text-muted-text">
              Data harian setahun terakhir; sebelumnya diringkas mingguan. Data terakhir{' '}
              {formatDateWib(latest, 'short')}.
            </p>
          </>
        )}
      </section>

      <section aria-labelledby="cakupan" className="flex flex-col gap-4">
        <h2 id="cakupan" className="text-heading-title-20">
          Cakupan data
        </h2>
        <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {COMMODITIES.map((c) => {
            const l = loaded.find((x) => x.series.code === c.code);
            return (
              <li
                key={c.code}
                className="flex flex-col gap-1 rounded-xl border border-line bg-surface p-4"
              >
                <span className="text-heading-card-16">{c.name}</span>
                {l === undefined ? (
                  <span className="text-body-small-13 text-ink-2">Data belum tersedia</span>
                ) : (
                  <>
                    <span className="text-body-small-13 text-ink-2">
                      {formatDateWib(l.first, 'short')} – {formatDateWib(l.last, 'short')}
                    </span>
                    <span className="text-body-small-13">
                      Terakhir {formatRupiah(l.lastPrice)}/kg
                    </span>
                  </>
                )}
              </li>
            );
          })}
        </ul>
      </section>

      <section aria-labelledby="prediksi-tabel" className="flex flex-col gap-4">
        <div className="flex flex-col gap-1">
          <h2 id="prediksi-tabel" className="text-heading-title-20">
            Perkiraan perubahan harga (ARIF-Net)
          </h2>
          <p className="text-body-small-13 text-ink-2">
            Nilai tengah dan rentang 80% harga per kg. Detail per komoditas ada di halaman Prediksi.
          </p>
        </div>
        <div
          className="overflow-x-auto rounded-xl border border-line bg-surface"
          tabIndex={0}
          role="region"
          aria-label="Tabel perkiraan, geser ke samping di layar sempit"
        >
          <table className="w-full min-w-[40rem] text-left text-[14px]">
            <caption className="sr-only">
              Perkiraan perubahan harga per komoditas dan horizon
            </caption>
            <thead className="bg-surface-2">
              <tr>
                <th scope="col" className="p-3 font-semibold">
                  Komoditas
                </th>
                {TABLE_HORIZONS.map((h) => (
                  <th key={h} scope="col" className="p-3 font-semibold">
                    {formatHorizon(h).long}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-line">
              {forecastRows.map((r) => (
                <tr key={r.code}>
                  <th scope="row" className="p-3 align-top font-semibold">
                    <a href={hrefs.forecast(r.code)} className="underline">
                      {r.name}
                    </a>
                    {r.labels.length > 0 ? (
                      <span className="block text-body-small-13 font-normal text-ink-2">
                        {r.labels.join(' · ')}
                      </span>
                    ) : null}
                  </th>
                  {r.cells.map((cell, i) => (
                    <td key={TABLE_HORIZONS[i]} className="p-3 align-top">
                      {cell === null ? (
                        <span className="text-ink-2">—</span>
                      ) : (
                        <>
                          <span className="block font-semibold">{cell.change}</span>
                          <span className="block text-body-small-13 text-ink-2">{cell.range}</span>
                        </>
                      )}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section
        aria-labelledby="unduh"
        className="flex flex-col gap-5 rounded-2xl bg-surface-2 p-4 sm:p-6"
      >
        <div className="flex flex-col gap-2">
          <h2 id="unduh" className="text-heading-title-20">
            Unduh data (CSV)
          </h2>
          <p className="text-body-medium-15 max-w-2xl text-ink-2">
            Untuk akun dengan peran Analis (peneliti, mahasiswa, TPID). Belum punya?{' '}
            <a href={accountHrefs.analyst()} className="font-semibold text-green-900 underline">
              Ajukan dari halaman akun
            </a>
            . Batas 30 unduhan per jam.
          </p>
        </div>
        <form method="get" action="/analis/unduh/harga.csv" className="flex flex-col gap-4">
          <fieldset className="flex flex-col gap-2">
            <legend className="text-overline-11 text-muted-text uppercase">
              Komoditas (kosongkan untuk semua)
            </legend>
            <div className="flex flex-wrap gap-x-5 gap-y-2">
              {COMMODITIES.map((c) => (
                <label key={c.code} className="inline-flex min-h-11 items-center gap-2 text-[14px]">
                  <input type="checkbox" name="komoditas" value={c.code} className="size-5" />
                  {c.name}
                </label>
              ))}
            </div>
          </fieldset>
          <div className="flex flex-wrap gap-4">
            <label className="flex flex-col gap-1.5 text-[14px]">
              Dari tanggal (harga)
              <input
                type="date"
                name="dari"
                className="min-h-11 rounded-md border border-line bg-surface px-3"
              />
            </label>
            <label className="flex flex-col gap-1.5 text-[14px]">
              Sampai tanggal (harga)
              <input
                type="date"
                name="sampai"
                className="min-h-11 rounded-md border border-line bg-surface px-3"
              />
            </label>
          </div>
          <div className="flex flex-wrap gap-3">
            <button
              type="submit"
              className="inline-flex min-h-11 items-center rounded-full bg-green-900 px-5 text-[14px] font-semibold text-surface"
            >
              Unduh harga.csv
            </button>
            <button
              type="submit"
              formAction="/analis/unduh/prediksi.csv"
              className="inline-flex min-h-11 items-center rounded-full border border-ink bg-surface px-5 text-[14px] font-semibold"
            >
              Unduh prediksi.csv
            </button>
          </div>
        </form>
        <Disclaimer />
        <p className="text-body-small-13 text-ink-2">
          Bila data dipakai ulang, cantumkan sumbernya: Kawan Pasar, dari data harga Pasar Kramat
          Jati.
        </p>
      </section>
    </PageContainer>
  );
}
