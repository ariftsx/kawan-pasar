/**
 * Static content of the ARIF-Net pages. Figures come from the capstone report v04 (Tabel 4.5,
 * "Hasil validasi ARIF-Net dan model pembanding"; source: ARIF-Net repository, commit dd93046).
 * Update together with the report; the test pins the values.
 */
export interface AccuracyRow {
  model: string;
  /** Mean relative MAE against persistence, validation folds F1–F2, 5 seeds. Lower is better. */
  relMae: number;
  note: string;
}

export const ACCURACY: readonly AccuracyRow[] = [
  { model: 'ARIF-Net (A0)', relMae: 0.85, note: 'Model usulan' },
  { model: 'BiLSTM', relMae: 0.861, note: 'Pembanding terbaik' },
  { model: 'Ridge', relMae: 0.874, note: 'Linear' },
  { model: 'Random forest', relMae: 0.876, note: 'Ensemble pohon' },
  { model: 'LightGBM', relMae: 0.881, note: 'Gradient boosting' },
  { model: 'SVR', relMae: 0.897, note: 'Kernel' },
  { model: 'GRU', relMae: 0.911, note: 'Rekuren' },
  { model: 'Temporal fusion transformer', relMae: 0.911, note: 'Berbasis atensi' },
  { model: 'Persistence', relMae: 1, note: 'Acuan: harga dianggap tetap' },
];

export const PROSPECTIVE_END = '2027-01-15';

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
      'ARIF-Net masih kandidat; uji prospektif berjalan sampai 15 Januari 2027.',
      'Lonjakan harga mendadak belum sepenuhnya tertangani.',
      'Keunggulan atas BiLSTM pada validasi masih tipis.',
      'Horizon 180 dan 365 hari belum dapat diuji secara prospektif.',
    ],
  },
  {
    title: 'Cara membaca',
    items: [
      'Prediksi adalah estimasi, bukan jaminan harga.',
      'Konteks (cuaca, berita) bukan bukti sebab-akibat.',
      'Rentang makin lebar untuk horizon yang lebih panjang.',
    ],
  },
  {
    title: 'Produk',
    items: [
      'Bukan rekomendasi jual/beli.',
      'Bukan harga real-time; mengikuti pembaruan harian.',
      'Angka prediksi saat ini memakai bundel prediksi demo, dan selalu diberi label "Data demo".',
    ],
  },
];

export const OPEN_DECISIONS: readonly { decision: string; status: string; impact: string }[] = [
  {
    decision: 'Arsitektur final ARIF-Net',
    status: 'Riset berjalan',
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
