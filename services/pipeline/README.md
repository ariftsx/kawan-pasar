# kp-pipeline — pipeline latih ulang ARIF-Net A0 (Fase 4)

Mengambil harga PIHPS, menjalankan preprocessing ARIF-Net, melatih ulang **ARIF-Net A0** (harga + kalender) untuk 5 komoditas, menilainya, lalu membuat **bundel kandidat**. Kandidat tidak pernah dipromosikan otomatis: admin mengaudit dan menyetujuinya (Fase 4C).

Desain: [`docs/design/2026-11-23-fase-4-pipeline-design.md`](../../docs/design/2026-11-23-fase-4-pipeline-design.md) · Rencana: [`docs/plans/2026-11-23-fase-4a-pipeline-arifnet.md`](../../docs/plans/2026-11-23-fase-4a-pipeline-arifnet.md).

## Langkah satu run

| Langkah      | Isi                                                                                                                                                                                                    |
| ------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `prepare`    | Salin kode ARIF-Net (`vendor/arifnet`, dicek `MANIFEST.sha256`) ke folder run, tulis `project.json` (5 komoditas, batas data dari kunci protokol), tautkan gudang bukti mentah, berkas iklim pengganti |
| `collect`    | `collect_calendar`, `collect_pihps full` (hanya bulan yang belum ada di gudang), `collect_pihps verify`                                                                                                |
| `preprocess` | `preprocess_pihps`, `build_target`, `build_dataset` (kode ARIF-Net apa adanya)                                                                                                                         |
| `prices`     | `prices_pihps.csv` (untuk `kp_ingest import-pihps`) dan `prices_model.csv` (untuk `kp_model`), ≤ batas data                                                                                            |
| `train`      | Penilaian: 5 seed pada jendela evaluasi (metode fold ARIF-Net); latih final 5 seed; konversi ke `.npz` + spesifikasi                                                                                   |
| `bundle`     | `kp_model` membuat bundel prediksi kandidat                                                                                                                                                            |

`run.json` mencatat status kunci, batas data, dan setiap langkah. Run yang terputus dilanjutkan dengan run id yang sama. Run tidak boleh dilanjutkan di lingkungan lain (Windows ↔ kontainer), karena tautan gudangnya berbeda.

## Kunci uji prospektif

Protokol ARIF-Net v1.1.0 melarang pipeline otomatis melatih atau mengevaluasi dengan data sesudah 2026-09-30 sebelum pembukaan resmi. Selama `config/prospective/OPENED.json` belum ada, batas data setiap run adalah 2026-09-30. Kunci terbuka hanya bila berkas itu (dari `results/prospektif/OPENED.json` ARIF-Net) adalah pembukaan prospektif yang selesai, bukan uji coba, dengan konfigurasi beku yang sama dengan registrasi (`config/prospective/registration.json`). Berkas itu di-gitignore karena memuat info mesin peneliti.

## Perintah

```sh
pnpm pipeline status              # status kunci
pnpm pipeline run [--quick]       # satu run di kontainer (--quick = 1 epoch, hanya untuk uji)
pnpm pipeline import <run-id>     # impor harga run itu ke produk (batas data = kunci saat ini)

# Lokal (Windows), dari services/pipeline:
uv run kp-pipeline seed --arifnet "D:\.Capstone dan TA\ARIF-Net" --store ../../data/pipeline/store
uv run kp-pipeline run --store ../../data/pipeline/store --runs ../../data/pipeline/runs
```

Gudang dan run ada di `data/pipeline/` (di-gitignore). **Jangan** menghapus folder run dengan `rm -rf` di Windows sebelum melepas tautan `arifnet/data/raw/pihps` (junction): lepas dulu dengan `os.rmdir`, agar gudang tidak ikut terhapus.
