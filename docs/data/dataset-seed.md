# Dataset Seed Harga (PIHPS — Pasar Kramat Jati)

Berkas: `data/seed/prices_combined.csv` (disediakan tim; **tidak di-commit** ke repo, lihat `data/README.md`).

## Fakta dataset (diaudit 11 Nov 2026)

| Hal                     | Nilai                                                             |
| ----------------------- | ----------------------------------------------------------------- |
| Kolom                   | `comcat_id, commodity, date, price` (UTF-8)                       |
| Baris data              | 5.859 (3 komoditas × 1.953 hari kerja)                            |
| Periode                 | 2 Jan 2019 – 30 Sep 2026                                          |
| Nilai kosong / duplikat | Tidak ada                                                         |
| Akhir pekan             | Tidak ada (hari kerja PIHPS)                                      |
| Celah terpanjang        | 11 hari (libur panjang). Celah **tidak** diisi atau diinterpolasi |

| `comcat_id` | Nama di CSV                | Rentang harga (Rp/kg) | Hari tanpa perubahan |
| ----------- | -------------------------- | --------------------- | -------------------- |
| `com_14`    | Cabai Merah Keriting       | 20.000 – 150.000      | 68,6%                |
| `com_11`    | Bawang Merah Ukuran Sedang | 25.000 – 82.500       | 80,9%                |
| `com_3`     | Beras Kualitas Medium I    | 11.950 – 16.100       | 96,4%                |

Cabai rawit hijau dan cabai rawit merah **tidak ada** di dataset. Keduanya tampil di UI dengan harga "—" dan status "Data belum tersedia".

Karena data berhenti 30 Sep 2026, seluruh harga berstatus **terlambat** (lebih dari 2 hari kerja) sampai adapter PIHPS berjalan. Itu perilaku yang benar sesuai aturan kejujuran informasi.

## Cara impor

Prasyarat: infrastruktur menyala, migrasi dan seed katalog sudah dijalankan (lihat `docs/operations/menjalankan-lokal.md`).

Lewat kontainer (disarankan; sama dengan cara kerja di server):

```bash
pnpm ingest:import
```

Perintah ini memakai `scripts/compose.mjs`, yang selalu menerapkan kedua berkas compose (dasar + dev-tools) dan meneruskan argumen tanpa shell. Karena itu path `/data/seed/...` aman dari konversi path Git Bash. **Jangan** menjalankan `docker compose` hanya dengan berkas dasar: compose akan membuat ulang PostgreSQL/PgBouncer tanpa port dev, dan alat di host akan kehilangan koneksi (`pnpm infra:check` mendeteksi kondisi ini).

Atau dari host (butuh `uv` dan variabel di `.env`):

```bash
cd services/ingest
uv run --env-file ../../.env python -m kp_ingest import-csv --file ../../data/seed/prices_combined.csv
```

Keluaran berupa ringkasan JSON, misalnya `{"run_id": 1, "status": "succeeded", "inserted": 5859, "skipped": 0, "rejected": 0}`.

| Kode keluar | Arti                                                                    |
| ----------- | ----------------------------------------------------------------------- |
| 0           | `succeeded`: semua baris valid                                          |
| 2           | `partial`: sebagian baris ditolak (lihat log `row rejected: line N: …`) |
| 1           | `failed` atau pemanggilan salah (env/berkas/pasar tidak dikenal)        |

## Perilaku validasi

| Masukan                                                                                                                              | Hasil                                                                            |
| ------------------------------------------------------------------------------------------------------------------------------------ | -------------------------------------------------------------------------------- |
| BOM UTF-8, akhir baris CRLF, spasi di sekitar nilai                                                                                  | Diterima (dibersihkan)                                                           |
| Harga `40000` atau `40000.0`                                                                                                         | Disimpan `40000` (integer rupiah)                                                |
| Harga dengan pemisah ribuan (`40.000`, `40,000`), eksponen (`1e4`), `40_000`, tanda `+`                                              | Baris ditolak (mencegah `40.000` terbaca Rp40)                                   |
| Harga pecahan (`40000.5`), < 100, kosong, bukan angka, `NaN`/`inf`, > 10.000.000                                                     | Baris ditolak, **tidak** disimpan sebagai 0                                      |
| Tanggal bukan format `YYYY-MM-DD` (mis. epoch `1727654400`, `30/09/2026`), sebelum 2000-01-01, tidak valid, atau di masa depan (WIB) | Baris ditolak                                                                    |
| `comcat_id` tidak ada di katalog                                                                                                     | Baris ditolak                                                                    |
| Header kurang kolom wajib (mis. CSV Excel berpemisah `;`)                                                                            | Run ditutup `failed` dengan alasan, tidak ada baris ditulis                      |
| Berkas bukan UTF-8 (mis. CP-1252)                                                                                                    | Run ditutup `failed`; batch yang sudah masuk tetap tersimpan dan view di-refresh |

Alasan penolakan di log hanya memuat nama field dan jenis galat, tanpa isi baris mentah.

## Impor ulang (idempoten)

Kunci unik `(pasar, komoditas, tanggal)` dengan `INSERT … ON CONFLICT DO NOTHING`. Impor ulang tidak menggandakan data dan **tidak menimpa** harga yang sudah ada; hasilnya `inserted 0, skipped 5859`. Koreksi harga historis (bila diperlukan) adalah fitur admin terpisah dan tidak dilakukan lewat impor ulang.

Setiap run tercatat di tabel `ingest_runs`. Setelah run selesai, `mv_latest_prices` di-refresh. Invalidasi cache web ditambahkan di Fase 1.
