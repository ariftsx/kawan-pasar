# kawan-pasar-ingest

Job ingest harga harian Kawan Pasar (docs 13 §A5). Job ini mengambil harga PIHPS untuk komoditas yang didukung, memvalidasinya, lalu menyiapkan baris untuk tabel staging dan published. Job berjalan harian pukul 06:30 WIB di VPS, terpisah dari pipeline model mingguan (D-16).

Saat ini berupa **skeleton**: katalog komoditas, antarmuka sumber harga, validasi, dan satu run lintas katalog yang diuji dengan sumber palsu. Dua hal belum ada:

- **Collector PIHPS.** Paket `arif-collect` dari repo ARIF-Net belum dipasang. Ini menunggu perbaikan collector (OPEN **ING-01**) dan refactor menjadi paket (D-20). Setelah itu dependensinya ditambahkan sebagai `arif-collect @ git+https://github.com/ariftsx/ARIF-Net@<sha>` dan dibungkus sebagai `PriceSource`.
- **Penyimpanan.** Penulisan ke Postgres (`staging_prices` → `published_prices`) menyusul di F2, bersama backfill sejak 2019-01-01.

## Menjalankan

```bash
cd services/ingest
uv sync
uv run pytest                              # coverage minimal 90%
uv run ruff format --check . && uv run ruff check .
uv run pyright                             # strict untuk ingest/
uv export --no-dev --no-hashes > /tmp/req.txt && uv run pip-audit -r /tmp/req.txt
```

## Katalog

`ingest/commodities.toml` berisi 3 komoditas model di Pasar Kramatjati (docs 08 §4.1, D-19): cabai merah keriting (`com_14`), bawang merah ukuran sedang (`com_11`), dan beras kualitas medium I (`com_3`). Menambah komoditas cukup lewat konfigurasi, tanpa mengubah kode. Komoditas lain menunggu DH-01.

## Aturan validasi

| Kasus                                                                                           | Hasil                                                 |
| ----------------------------------------------------------------------------------------------- | ----------------------------------------------------- |
| Satuan tidak sama dengan katalog, harga ≤ 0, tanggal di masa depan, atau tanggal yang sudah ada | **Ditolak**, dengan alasan dicatat di laporan         |
| Harga menyimpang lebih dari ±60% dari median harga `valid` 7 hari kalender sebelumnya           | **Dikarantina** (`quarantined`), tidak dipublikasikan |
| Selain itu                                                                                      | `valid`                                               |

- `available_at` dicatat saat baris benar-benar diterima (setelah fetch selesai), dalam WIB. Forecast pada origin `t` hanya boleh memakai harga dengan `available_at ≤ t`.
- Hari tanpa observasi **tidak diisi**: tidak ada nol dan tidak ada interpolasi (docs 05 §4.1).
- Bila tidak ada harga `valid` dalam 7 hari sebelumnya, tidak ada pembanding, sehingga baris diterima sebagai `valid`.
- Satu sumber yang gagal tidak menghentikan komoditas lain. Komoditasnya dicatat di `IngestReport.failed`.

## Aturan sumber harga

Setiap implementasi `PriceSource` wajib:

- maksimal 1 request per detik, dengan User-Agent yang jelas;
- menghormati syarat pakai penyedia (OPEN **DATA-01**);
- hanya mengambil data. Validasi selalu terjadi di `ingest/validate.py`.

Produk tidak mengambil berita, iklim, atau BBM. Modalitas itu hanya ada di pipeline mingguan ARIF-Net.
