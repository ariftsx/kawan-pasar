# ADR 0006 — Bundel prediksi demo berlabel

- **Status:** Diterima (12 Nov 2026). Sejak 19 Nov 2026 bundel ARIF-Net aktif ([ADR 0012](0012-penerapan-arif-net.md)); bundel demo tetap sebagai cadangan pengembangan dan tergeser otomatis (§ 4).

## Konteks

Model ARIF-Net belum menerbitkan bundel produksi, tetapi halaman Prediksi harus bisa dibangun dan diuji dengan data yang bentuknya sama persis dengan bundel asli. Laporan (§4.4.2) mengizinkan mode pengembangan dengan data berlabel demo, asalkan tidak ada prediksi tanpa keterangan asal.

## Keputusan

1. **Metode: kuantil empiris historis.** Metode ini **bukan** ARIF-Net dan tidak mengklaim akurasi apa pun. Untuk setiap komoditas `covered` dan horizon h, dikumpulkan perubahan relatif r = P(t′)/P(t) − 1 untuk setiap hari observasi t dalam 730 hari terakhir, dengan t′ = observasi terakhir ≤ t + h hari. q10/q50/q90 = kuantil interpolasi linear dari r. Harga = `round(harga dasar × (1 + q))`.
2. **Identitas bundel:** `model_name = demo`, `model_version = demo-empirical-quantile-v1`, `data_version = seed-csv-<tanggal>`, `preprocess_version = none`, dan `is_demo = true` di database. UI **wajib** menampilkan label "Data demo" setiap kali `artifact.isDemo` bernilai benar.
3. **Jalur yang sama dengan bundel asli:** generator menulis direktori bundel (`metadata.json`, `forecasts.csv`, `SHA256SUMS`) ke `services/model-arifnet/artifacts/` (diabaikan git), lalu `promoteBundle` memverifikasi dan mengaktifkannya.
4. **Prioritas tampil:** endpoint memilih bundel aktif **non-demo** terbaru, dan baru memakai bundel demo bila tidak ada. Begitu bundel ARIF-Net dipromosikan, bundel demo tergeser otomatis tanpa perubahan kode. Satu bundel aktif per `model_name` dijaga oleh constraint DB.
5. `eval_status`: h ≤ 30 → `available`, 90 → `partial`, 180/365 → `not_tested`, sesuai prototipe.

## Konsekuensi

- Karena 69–96% perubahan harian bernilai nol (lihat `docs/data/dataset-seed.md`), median horizon pendek biasanya 0 ("stabil") dengan rentang yang lebar untuk cabai. Itu sifat data, bukan galat.
- Bundel demo juga tunduk pada aturan umur 8/28 hari. Jalankan ulang `pnpm --filter @kawan-pasar/api bundle:demo` bila label kedaluwarsa muncul di lingkungan dev.
