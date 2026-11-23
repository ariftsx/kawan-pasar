# Rencana Fase 4A — Kode Pipeline ARIF-Net dan Adapter PIHPS

- Tanggal: 23 November 2026
- Status: **disetujui pemilik 23 Nov 2026** ("Setuju, mulai 4A")
- Desain: [`docs/design/2026-11-23-fase-4-pipeline-design.md`](../design/2026-11-23-fase-4-pipeline-design.md)

## Temuan sebelum rencana

- A0 hanya memakai harga + kalender. Modul yang dibutuhkan: koleksi PIHPS dan kalender, preprocessing (`preprocess_pihps`, `build_target`, `build_dataset`), pelatihan (`03_training` inti, `04_arif_net` model/train/fit_final), `arifnet_core`, dan konfigurasi beku `results/frozen/arifnet.json`.
- Komoditas, periode, dan `train_end` dibaca dari `configs/project.json`, sehingga salinan kode tidak perlu diubah: pipeline membuat `project.json` sendiri dari katalog Kawan Pasar.
- `kp_model` (inferensi) sudah membaca daftar komoditas dari spesifikasi; konverter masih mengunci 3 kode produk.
- `comcat_id` cabai rawit belum diketahui: dicari sekali dari referensi PIHPS.

## Tugas

| #   | Tugas                                                                                                                                                                                                                                                                              | Uji                                                                    |
| --- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------- |
| 1   | **Salinan kode ARIF-Net** dari folder lokal ke `services/pipeline/vendor/arifnet/` (hanya modul A0), `LICENSE` MIT, `SOURCE.md` (folder sumber, commit `7ae2731` + daftar perubahan lokal yang belum di-commit), `MANIFEST.sha256`. Pipeline menolak jalan bila sidik tidak cocok. | Unit: manifest cocok/berubah                                           |
| 2   | **Konfigurasi pipeline** dari `packages/catalog`: `project.json` (5 komoditas, periode sampai batas data, `train_end`), folder kerja, tanpa menyentuh berkas tersalin.                                                                                                             | Unit                                                                   |
| 3   | **Kunci protokol:** salinan `REGISTERED.json` (sha256 dicatat); kunci terbuka hanya bila `OPENED.json` ada dan merujuk sha256 registrasi yang sama. Terkunci → batas data 2026-09-30 untuk koleksi, impor, dan latih.                                                              | Unit: terkunci, terbuka, berkas palsu                                  |
| 4   | **Adapter PIHPS di `kp_ingest`:** `PihpsSource` membaca JSON mentah collector (tanggal `DD/MM/YYYY`, harga `"40,000"`, `"-"` = tidak dilaporkan), hormati batas data, CLI `import-pihps`.                                                                                          | Unit dengan fixture, integrasi impor                                   |
| 5   | **Cabai rawit:** cari `comcat_id` dari referensi PIHPS (mode referensi collector, sekali), catat di katalog dan `docs/data/katalog.md`.                                                                                                                                            | Unit katalog                                                           |
| 6   | **CLI `kp-pipeline`:** langkah `collect` → `preprocess` → `fit` → `convert` → `bundle`, folder kerja per run, dapat dilanjutkan, manifest per langkah. Bundel keluaran berstatus kandidat (tidak pernah dipromosikan otomatis).                                                    | Unit + uji ujung ke ujung kecil (epoch dikurangi) dengan data ≤ cutoff |
| 7   | **Konverter 5 komoditas:** kode produk dari katalog, bukan peta tetap.                                                                                                                                                                                                             | Unit + golden                                                          |
| 8   | **Image `pipeline`** (Python + PyTorch CPU) dan perintah `pnpm pipeline:run` (sementara tanpa Airflow; Airflow di 4B), tanpa Docker socket, keluaran di volume.                                                                                                                    | Build + run lokal ≤ cutoff                                             |
| 9   | **Dokumen + audit `fase-4a.md`.**                                                                                                                                                                                                                                                  | —                                                                      |

## Selesai bila

`pnpm audit:all` lulus, satu run pipeline penuh ≤ cutoff menghasilkan bundel kandidat 5 komoditas yang lolos verifikator bundel dan `kp_model`, dan tinjauan independen tanpa temuan berat/sedang terbuka.
