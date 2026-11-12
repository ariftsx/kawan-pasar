import type {
  ArticleListItem,
  CommoditySummary,
  ForecastResponse,
  HistoryResponse,
  PricePoint,
  PriceSummaryResponse,
} from '@kawan-pasar/contracts';

/** Fixtures shaped like the real API on 12 Nov 2026 (seed data + demo bundle). */
const market = {
  code: 'PIKJ',
  name: 'Pasar Kramat Jati',
  city: 'Jakarta Timur',
  status: 'available',
} as const;

export const ARTIFACT = {
  modelName: 'demo',
  modelVersion: 'demo-empirical-quantile-v1',
  dataVersion: 'seed-csv-2026-09-30',
  preprocessVersion: 'none',
  dataCutoff: '2026-09-30T16:59:59.000Z',
  issuedAt: '2026-11-11T22:21:50.025Z',
  isDemo: true,
  ageDays: 0,
} as const;

const spark = (base: number): PricePoint[] =>
  Array.from({ length: 30 }, (_, i) => ({
    observedOn: new Date(Date.UTC(2026, 8, 1 + i)).toISOString().slice(0, 10),
    priceIdr: base + i * 100,
  }));

const summaryItem = (over: Partial<CommoditySummary>): CommoditySummary => ({
  code: 'cabai-merah-keriting',
  name: 'Cabai merah keriting',
  unit: 'kg',
  modelCoverage: 'covered',
  dataStatus: 'stale',
  latest: { observedOn: '2026-09-30', priceIdr: 63_150 },
  change7d: 0,
  change30d: 0.4223,
  sparkline: spark(44_000),
  forecast7d: { status: 'available', q50Change: 0, direction: 'flat' },
  ...over,
});

const noData = (code: 'cabai-rawit-hijau' | 'cabai-rawit-merah', name: string): CommoditySummary =>
  summaryItem({
    code,
    name,
    modelCoverage: 'pending',
    dataStatus: 'no_data',
    latest: null,
    change7d: null,
    change30d: null,
    sparkline: [],
    forecast7d: { status: 'pending_coverage', q50Change: null, direction: null },
  });

export function summaryFixture(over: Partial<PriceSummaryResponse> = {}): PriceSummaryResponse {
  return {
    market,
    latestObservedOn: '2026-09-30',
    forecastArtifact: ARTIFACT,
    items: [
      summaryItem({}),
      summaryItem({
        code: 'bawang-merah',
        name: 'Bawang merah',
        latest: { observedOn: '2026-09-30', priceIdr: 40_300 },
        change7d: 0.0661,
        change30d: 0,
        sparkline: spark(37_000),
      }),
      summaryItem({
        code: 'beras-medium-1',
        name: 'Beras medium I',
        latest: { observedOn: '2026-09-30', priceIdr: 16_100 },
        change7d: 0,
        change30d: 0,
        sparkline: spark(16_100).map((p) => ({ ...p, priceIdr: 16_100 })),
      }),
      noData('cabai-rawit-hijau', 'Cabai rawit hijau'),
      noData('cabai-rawit-merah', 'Cabai rawit merah'),
    ],
    ...over,
  };
}

const HORIZON_DAYS = [1, 3, 7, 14, 30, 90, 180, 365] as const;

export function forecastFixture(over: Partial<ForecastResponse> = {}): ForecastResponse {
  return {
    market,
    commodity: {
      code: 'cabai-merah-keriting',
      name: 'Cabai merah keriting',
      modelCoverage: 'covered',
    },
    status: 'available',
    artifact: ARTIFACT,
    baseDate: '2026-09-30',
    basePriceIdr: 63_150,
    horizons: HORIZON_DAYS.map((d) => {
      const known = d <= 90;
      return {
        horizonDays: d,
        targetDate: new Date(Date.UTC(2026, 8, 30 + d)).toISOString().slice(0, 10),
        q10Change: known ? -0.12 : null,
        q50Change: known ? 0.028 : null,
        q90Change: known ? 0.17 : null,
        q10PriceIdr: known ? 55_460 : null,
        q50PriceIdr: known ? 64_918 : null,
        q90PriceIdr: known ? 73_735 : null,
        evalStatus: known ? 'available' : 'not_tested',
      };
    }),
    ...over,
  };
}

export function historyFixture(days: number): HistoryResponse {
  const points: PricePoint[] = Array.from({ length: days }, (_, i) => ({
    observedOn: new Date(Date.UTC(2026, 8, 30 - (days - 1 - i))).toISOString().slice(0, 10),
    priceIdr: 50_000 + i * 50,
  }));
  return {
    market,
    commodity: { code: 'cabai-merah-keriting', name: 'Cabai merah keriting' },
    range: '90d',
    downsampled: false,
    points,
  };
}

export const ARTICLES: ArticleListItem[] = [
  {
    slug: 'apa-itu-inflasi-pangan',
    category: 'dasar',
    title: 'Apa itu inflasi pangan, dan apa dampaknya ke belanja dapur?',
    summary: 'Penjelasan singkat tentang inflasi.',
    readingMinutes: 5,
    publishedAt: '2026-11-12T00:00:00.000Z',
  },
];
