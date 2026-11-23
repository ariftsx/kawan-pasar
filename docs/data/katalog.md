# Katalog Komoditas, Pasar, dan Horizon

Sumber kebenaran ada di kode: `packages/catalog/src/`. Tabel `commodities` dan `markets` di database diisi dari katalog ini melalui seed (`pnpm --filter @kawan-pasar/api db:seed`), sehingga kode dan database tidak boleh berbeda isi.

## Komoditas

| Urutan | Kode                   | Nama                 | `comcat_id` PIHPS | Nama di dataset seed       | Cakupan model ARIF-Net        |
| ------ | ---------------------- | -------------------- | ----------------- | -------------------------- | ----------------------------- |
| 1      | `cabai-merah-keriting` | Cabai merah keriting | `com_14`          | Cabai Merah Keriting       | `covered`                     |
| 2      | `bawang-merah`         | Bawang merah         | `com_11`          | Bawang Merah Ukuran Sedang | `covered`                     |
| 3      | `beras-medium-1`       | Beras medium I       | `com_3`           | Beras Kualitas Medium I    | `covered`                     |
| 4      | `cabai-rawit-hijau`    | Cabai rawit hijau    | `com_15`          | Cabai Rawit Hijau          | `pending` (prediksi menyusul) |
| 5      | `cabai-rawit-merah`    | Cabai rawit merah    | `com_16`          | Cabai Rawit Merah          | `pending` (prediksi menyusul) |

Satuan seluruh komoditas: rupiah per kilogram (`kg`).

`comcat_id` komoditas 4 dan 5 diambil dari referensi resmi PIHPS (`GetRefCommodityAndCategory`, kategori `cat_8` Cabai Rawit) pada 23 Nov 2026 dan dikonfirmasi pemilik. Harga keduanya masuk lewat pipeline Fase 4 (riwayat ≤ 30 Sep 2026 sekarang, data sesudahnya setelah uji prospektif ARIF-Net dibuka). Prediksinya tetap "menyusul" sampai bundel ARIF-Net 5 komoditas disetujui admin. Daftar ini dicerminkan ke `services/pipeline/config/commodities.json`, dan uji katalog memastikan keduanya sama.

## Pasar

| Kode   | Nama                     | Kota          | Status                         |
| ------ | ------------------------ | ------------- | ------------------------------ |
| `PIKJ` | Pasar Kramat Jati        | Jakarta Timur | `available`                    |
| `PSEN` | Pasar Senen              | Jakarta Pusat | `coming_soon` (belum tersedia) |
| `PITT` | Pasar Induk Tanah Tinggi | Tangerang     | `coming_soon`                  |
| `PBKS` | Pasar Bekasi             | Bekasi        | `coming_soon`                  |

Nama pasar `coming_soon` diambil dari layar Pilih Pasar pada prototipe v0.4.

## Horizon prediksi

`1, 3, 7, 14, 30, 90, 180, 365` hari. Daftar ini dipakai oleh validasi skema, constraint database (`forecasts.horizon_days`), dan antarmuka pemilih horizon.
