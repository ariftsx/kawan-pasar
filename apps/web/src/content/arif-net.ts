/**
 * Static content of the ARIF-Net pages. Figures are the validation results of the model the
 * product runs: ARIF-Net v1.1.0 (full re-run 10–17 Nov 2026), frozen A0, folds F1–F2 × 5 seeds,
 * as recorded in services/model-arifnet/model/arifnet-a0.json. A test checks them against that
 * file. (Report v04 Tabel 4.5 still shows the earlier v1.0 run.)
 */
export interface AccuracyRow {
  model: string;
  /** Mean relative MAE against persistence, validation folds F1–F2, 5 seeds. Lower is better. */
  relMae: number;
  note: string;
}

export const ACCURACY: readonly AccuracyRow[] = [
  { model: 'ARIF-Net (A0)', relMae: 0.85, note: 'Model yang dipakai' },
  { model: 'BiLSTM', relMae: 0.863, note: 'Pembanding terbaik' },
  { model: 'Ridge', relMae: 0.874, note: 'Linear' },
  { model: 'Random forest', relMae: 0.88, note: 'Ensemble pohon' },
  { model: 'LightGBM', relMae: 0.887, note: 'Gradient boosting' },
  { model: 'SVR', relMae: 0.897, note: 'Kernel' },
  { model: 'Temporal fusion transformer', relMae: 0.899, note: 'Berbasis atensi' },
  { model: 'GRU', relMae: 0.909, note: 'Rekuren' },
  { model: 'Persistence', relMae: 1, note: 'Acuan: harga dianggap tetap' },
];

/** ARIF-Net validation relMAE per commodity and horizon (same source; < 1 beats "unchanged"). */
export const ACCURACY_BY_HORIZON: readonly { commodity: string; relMae: readonly number[] }[] = [
  {
    commodity: 'Cabai merah keriting',
    relMae: [1.0085, 1.001, 0.9835, 0.9495, 0.885, 0.7466, 0.7354, 0.7842],
  },
  {
    commodity: 'Bawang merah',
    relMae: [1.0011, 0.9954, 0.9764, 0.9258, 0.8802, 0.7903, 0.6738, 0.8671],
  },
  {
    commodity: 'Beras medium I',
    relMae: [1, 1.0017, 1.0161, 1.0359, 0.9971, 1.0284, 1.0936, 0.978],
  },
];
export const ACCURACY_HORIZONS = [1, 3, 7, 14, 30, 90, 180, 365] as const;

/** The blind prospective test (data after 30 Sep 2026) is opened once, after this date. */
export const PROSPECTIVE_OPENS = '2026-11-30';

export const PIPELINE: readonly { title: string; note: string }[] = [
  { title: 'Data harga PIHPS', note: 'Kramat Jati · harian' },
  { title: 'Selaraskan waktu', note: '+ cek kebocoran data' },
  { title: 'Dataset berversi', note: 'manifest' },
  { title: 'Latih & uji', note: 'latih · validasi · uji' },
  { title: 'Model tervalidasi', note: 'bundel berversi' },
  { title: 'Kawan Pasar', note: 'harga + prediksi' },
];

export const PARTS: readonly { title: string; body: string }[] = [
  {
    title: 'Pembaca pola harga',
    body: 'Jaringan GRU membaca riwayat harga harian untuk menangkap pola terbaru.',
  },
  {
    title: 'Kepala kejadian',
    body: 'Memperkirakan peluang harga berubah atau tetap; banyak harga pangan memang tidak berubah setiap hari.',
  },
  {
    title: 'Kepala rentang (kuantil)',
    body: 'Memperkirakan rentang perubahan harga (batas bawah, tengah, atas) yang selalu berurutan.',
  },
  {
    title: 'Tren & musiman',
    body: 'Menambahkan arah tren jangka panjang dan pola musiman untuk horizon 90 hingga 365 hari.',
  },
];

export const LIMITS: readonly { title: string; items: readonly string[] }[] = [
  {
    title: 'Data',
    items: [
      'Tahap awal: 1 pasar (Pasar Kramat Jati) dan 3 komoditas.',
      'Harga tiap wilayah berbeda; pasar lain belum tersedia.',
      'Cabai rawit hijau dan cabai rawit merah belum diprediksi.',
      'Data harga bergantung pada jadwal rilis PIHPS.',
    ],
  },
  {
    title: 'Model',
    items: [
      'Angka akurasi adalah hasil validasi. Uji prospektif buta (data sesudah 30 September 2026) baru dibuka sesudah 30 November 2026.',
      'Untuk 1 sampai 7 hari ke depan, ARIF-Net setara dengan anggapan "harga tetap". Keunggulannya baru terlihat mulai 14 hari.',
      'Untuk beras medium I, ARIF-Net belum lebih akurat daripada anggapan "harga tetap"; prediksinya hampir selalu "stabil".',
      'Lonjakan harga mendadak belum sepenuhnya tertangani.',
      'Keunggulan atas BiLSTM pada validasi masih tipis.',
      'Prediksi 180 dan 365 hari memakai perkiraan tanggal Ramadan, Idulfitri, dan Iduladha 2027, sampai tanggal resmi (SKB) tersedia.',
    ],
  },
  {
    title: 'Cara membaca',
    items: [
      'Prediksi adalah estimasi, bukan jaminan harga.',
      'Konteks (cuaca, berita) bukan bukti sebab-akibat.',
      'Rentang makin lebar untuk horizon yang lebih panjang.',
      'Status uji "Sebagian": pada validasi, ARIF-Net belum lebih akurat daripada anggapan "harga tetap" untuk komoditas dan horizon itu.',
    ],
  },
  {
    title: 'Produk',
    items: [
      'Bukan rekomendasi jual/beli.',
      'Bukan harga real-time; mengikuti pembaruan harian.',
      'Setiap prediksi mencantumkan versi model dan tanggal data yang dipakai. Bila model belum tersedia, angka berasal dari bundel demo berlabel "Data demo".',
    ],
  },
];

export const OPEN_DECISIONS: readonly { decision: string; status: string; impact: string }[] = [
  {
    decision: 'Arsitektur final ARIF-Net',
    status: 'A0 dibekukan; menunggu uji prospektif',
    impact: 'Label status model dan teks penjelasan',
  },
  { decision: 'Perluasan multi-pasar', status: 'Tahap TA', impact: 'Pilihan pasar di navigasi' },
  {
    decision: 'Rentang ketidakpastian per horizon',
    status: 'Rencana',
    impact: 'Area rentang di grafik',
  },
  {
    decision: 'Jadwal pembaruan mingguan',
    status: 'Rencana',
    impact: 'Info "data sampai" di setiap halaman',
  },
];
