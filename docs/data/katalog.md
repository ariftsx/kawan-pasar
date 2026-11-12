# Katalog Komoditas, Pasar, dan Horizon

Sumber kebenaran ada di kode: `packages/catalog/src/`. Tabel `commodities` dan `markets` di database diisi dari katalog ini melalui seed (`pnpm --filter @kawan-pasar/api db:seed`), sehingga kode dan database tidak boleh berbeda isi.

## Komoditas

| Urutan | Kode                   | Nama                 | `comcat_id` PIHPS | Nama di dataset seed       | Cakupan model ARIF-Net        |
| ------ | ---------------------- | -------------------- | ----------------- | -------------------------- | ----------------------------- |
| 1      | `cabai-merah-keriting` | Cabai merah keriting | `com_14`          | Cabai Merah Keriting       | `covered`                     |
| 2      | `bawang-merah`         | Bawang merah         | `com_11`          | Bawang Merah Ukuran Sedang | `covered`                     |
| 3      | `beras-medium-1`       | Beras medium I       | `com_3`           | Beras Kualitas Medium I    | `covered`                     |
| 4      | `cabai-rawit-hijau`    | Cabai rawit hijau    | belum ada         | belum ada di dataset       | `pending` (prediksi menyusul) |
| 5      | `cabai-rawit-merah`    | Cabai rawit merah    | belum ada         | belum ada di dataset       | `pending` (prediksi menyusul) |

Satuan seluruh komoditas: rupiah per kilogram (`kg`).

Komoditas 4 dan 5 tetap tampil di antarmuka dengan harga "—" dan status "Data belum tersedia" (keputusan pemilik, 11 Nov 2026). `comcat_id` keduanya diisi setelah adapter PIHPS dibuat (Fase 4).

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
