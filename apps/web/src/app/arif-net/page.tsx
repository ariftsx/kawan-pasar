import { Illustration } from '@/components/brand/illustration';
import {
  KataKapa,
  Overline,
  PageHeader,
  StatusChip,
  Surface,
  TextLink,
} from '@/components/kp/blocks';

import type { Metadata } from 'next';

export const metadata: Metadata = { title: 'Kenalan dengan ARIF-Net' };

// Walk-forward benchmark of the ARIF-Net research repo (relative MAE against persistence, lower
// is better). Values are research results, not a guarantee of future accuracy.
const BENCHMARK: readonly { model: string; relMae: number; isOurs?: boolean }[] = [
  { model: 'ARIF-Net A0', relMae: 0.85, isOurs: true },
  { model: 'BiLSTM', relMae: 0.861 },
  { model: 'Ridge', relMae: 0.874 },
  { model: 'Random Forest', relMae: 0.876 },
  { model: 'LightGBM', relMae: 0.881 },
  { model: 'SVR', relMae: 0.897 },
  { model: 'GRU', relMae: 0.911 },
  { model: 'TFT', relMae: 0.911 },
  { model: 'Persistence', relMae: 1 },
];

const STEPS = [
  {
    title: 'Harga harian',
    body: 'Riwayat harga PIHPS Pasar Kramat Jati untuk tiap komoditas.',
  },
  {
    title: 'Konteks',
    body: 'Cuaca di wilayah pemasok, berita dan sentimen IndoBERT, kalender, serta biaya distribusi.',
  },
  {
    title: 'Encoder GRU dan drift',
    body: 'Pola jangka pendek dipelajari GRU; tren jangka panjang dijaga komponen drift.',
  },
  {
    title: 'Perkiraan multi-horizon',
    body: 'Satu perkiraan per horizon dari 1 hari sampai 1 tahun, dengan provenance lengkap.',
  },
] as const;

function BenchmarkChart() {
  const width = 640;
  const rowH = 36;
  const labelW = 150;
  const max = 1.05;
  const height = BENCHMARK.length * rowH;
  return (
    <figure className="flex flex-col gap-3">
      <svg
        viewBox={`0 0 ${String(width)} ${String(height)}`}
        role="img"
        aria-label="Galat relatif (relMAE) tiap model terhadap persistence; makin kecil makin baik. ARIF-Net A0 0,850 adalah yang terendah."
        className="h-auto w-full"
      >
        {BENCHMARK.map((item, index) => {
          const y = index * rowH;
          const w = ((width - labelW - 60) * item.relMae) / max;
          return (
            <g key={item.model}>
              <text
                x={0}
                y={y + rowH / 2 + 5}
                className={
                  item.isOurs === true ? 'fill-text-primary font-bold' : 'fill-text-secondary'
                }
                fontSize={14}
              >
                {item.model}
              </text>
              <rect
                x={labelW}
                y={y + 8}
                width={w}
                height={rowH - 16}
                rx={6}
                className={item.isOurs === true ? 'fill-chart-forecast' : 'fill-chart-grid'}
              />
              <text
                x={labelW + w + 8}
                y={y + rowH / 2 + 5}
                fontSize={14}
                className="fill-text-primary font-mono"
              >
                {item.relMae.toFixed(3).replace('.', ',')}
              </text>
            </g>
          );
        })}
      </svg>
      <figcaption className="text-sm text-text-muted">
        relMAE = MAE model dibagi MAE persistence (harga besok sama dengan hari ini). Nilai di bawah
        1 berarti lebih baik daripada persistence. Rata-rata validasi berjalan maju, tiga komoditas.
      </figcaption>
    </figure>
  );
}

export default function ArifNetPage() {
  return (
    <div className="flex flex-col gap-8">
      <PageHeader
        overline="ARIF-Net"
        title="Kenalan dengan model prediksi Kawan Pasar"
        description="ARIF-Net (Adaptive Regime-Informed Forecasting Network) memperkirakan harga harian beberapa komoditas pangan di Pasar Kramat Jati."
        aside={<Illustration name="arif-net" className="hidden w-52 md:block" />}
      />

      <section aria-labelledby="cara-title" className="flex flex-col gap-4">
        <h2 id="cara-title" className="text-2xl font-extrabold">
          Cara kerjanya
        </h2>
        <ol className="grid grid-cols-1 gap-4 md:grid-cols-4">
          {STEPS.map((step, index) => (
            <li
              key={step.title}
              className="flex flex-col gap-2 rounded-3xl border border-border-default bg-bg-surface p-5"
            >
              <span className="font-mono text-sm text-accent-forecast-fg">
                {String(index + 1).padStart(2, '0')}
              </span>
              <span className="text-lg font-bold">{step.title}</span>
              <span className="text-base text-text-secondary">{step.body}</span>
            </li>
          ))}
        </ol>
      </section>

      <Surface className="flex flex-col gap-4" aria-labelledby="hasil-title">
        <div className="flex flex-col gap-1">
          <Overline>Hasil penelitian</Overline>
          <h2 id="hasil-title" className="text-2xl font-extrabold">
            Dibandingkan dengan model lain
          </h2>
        </div>
        <BenchmarkChart />
      </Surface>

      <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
        <Surface className="flex flex-col gap-3" aria-labelledby="uji-title">
          <h2 id="uji-title" className="text-xl font-extrabold">
            Uji prospektif
          </h2>
          <p className="text-base text-text-secondary">
            Perkiraan yang diterbitkan dicocokkan dengan harga yang benar-benar terjadi sampai 15
            Januari 2027. Hasilnya akan dilaporkan apa adanya, termasuk bila lebih buruk dari hasil
            penelitian.
          </p>
          <StatusChip tone="highlight" className="self-start">
            Berjalan
          </StatusChip>
        </Surface>
        <KataKapa
          pose="menunjuk"
          title="Model terbaik di uji coba belum tentu terbaik besok."
          link={{ href: '/arif-net/keterbatasan', label: 'Baca keterbatasan' }}
        >
          Angka di atas adalah hasil pada data masa lalu. Pakai prediksi sebagai gambaran, bukan
          kepastian.
        </KataKapa>
      </div>
      <TextLink href="/prediksi">Lihat prediksi terbaru</TextLink>
    </div>
  );
}
