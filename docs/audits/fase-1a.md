# Audit Fase 1A — API Publik

- Tanggal: 12 November 2026
- Rencana: [`docs/plans/2026-11-12-fase-1a-api-publik.md`](../plans/2026-11-12-fase-1a-api-publik.md)
- Status: **Lulus dengan satu sasaran performa terbuka (§3). Menunggu tinjauan pemilik sebelum Fase 1B.**

## 1. Yang dihasilkan

| Area          | Hasil                                                                                                                                                                           |
| ------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Kontrak       | Paket `@kawan-pasar/contracts`: skema Zod untuk semua respons/kueri, dipakai API dan nanti web (validasi ganda)                                                                 |
| Endpoint      | `GET /v1/markets`, `…/prices`, `…/history`, `…/forecast`, `/v1/articles`, `/v1/articles/:slug`, `POST /internal/cache/invalidate` (`docs/api/v1.md`)                            |
| Keamanan      | Token layanan (constant-time), proxy tepercaya eksplisit, rate limit Valkey 120/menit per klien (fail-open + log terbatas), galat seragam tanpa memantulkan input, body ≤ 1 MiB |
| Performa      | 1 query agregat per endpoint (≤ 2 saat cache kosong, 0 saat hangat, diuji), cache single-flight, teks JSON dari cache untuk respons besar (ADR 0007)                            |
| Prediksi      | Verifikasi & promosi bundel (checksum, skema, cakupan, duplikat, umur, cutoff, waktu terbit di masa depan, bundel lebih lama), bundel demo berlabel (ADR 0006)                  |
| Aturan produk | Terlambat > 2 hari kerja; kedaluwarsa > 8 hari; tersembunyi > 28 hari; tidak diketahui = `null`; status ringkasan konsisten dengan `/forecast`                                  |
| Konten        | 6 artikel: 1 terbit, 5 draf menunggu tinjauan pemilik (`docs/product/konten-artikel.md`)                                                                                        |
| Bawaan Fase 0 | `trustProxy` dipersempit, nomor baris di log ingest, overflow `sort_order`, CHECK harga ≤ Rp10 jt dan tanggal ≥ 2000-01-01, panduan uji                                         |

## 2. Gerbang mutu

`pnpm audit:all`: lihat §6 untuk keluaran run terakhir. Ringkasan uji:

| Paket           | Uji                                                       |
| --------------- | --------------------------------------------------------- |
| contracts       | 12 unit                                                   |
| catalog         | 7 unit                                                    |
| api             | 49 unit + 94 integrasi (DB, Valkey, dan app Fastify asli) |
| ingest (Python) | 54 uji, cakupan ±97%                                      |

## 3. Uji beban (k6) — `docs/testing/uji-beban.md`

| Kondisi                                                 | Hasil                                                                              |
| ------------------------------------------------------- | ---------------------------------------------------------------------------------- |
| Awal (sebelum optimasi)                                 | p95 **9,75 s**, galat 0,1%                                                         |
| Setelah cache teks JSON, 1 replika, 200 pengguna × 60 s | 20.082 permintaan, **0% galat**, median 47 ms, **p95 378 ms**, **34 transaksi DB** |
| Rate limit (1 klien, 150 permintaan)                    | 120 × 200, 30 × 429; klien lain tetap 200 ✔                                        |
| Valkey dimatikan                                        | Semua endpoint tetap 200 dari DB; readiness `cache: down`; pulih tanpa restart ✔   |

**Sasaran p95 < 100 ms belum tercapai** di laptop dev (4 vCPU dipakai bersama oleh k6, API, DB, cache, dan Windows). Bukti bahwa batasnya ada di perangkat: server Node polos pada jaringan yang sama hanya mencapai 4,6 rb req/s, dan uji 2 replika tidak membaik karena berebut CPU yang sama. Validasi ulang di Fase 1D, dengan k6 di mesin terpisah dan seluruh tumpukan aktif (halaman publik dilayani cache Next.js).

## 4. Temuan selama fase (diperbaiki dengan uji yang gagal lebih dulu)

| #   | Tingkat     | Temuan                                                                                                                                                                   | Perbaikan                                                                                                  |
| --- | ----------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ---------------------------------------------------------------------------------------------------------- |
| 1   | **Penting** | **Log permintaan API mati sejak Fase 0**: rute default nestjs-pino (`*`) tidak cocok dengan router Nest 12, sehingga redaksi header juga tidak pernah benar-benar teruji | `forRoutes: '{*splat}'`, health dikecualikan; uji menangkap stream log (request tercatat, token tersensor) |
| 2   | Penting     | p95 9,75 s di bawah beban (respons besar di-parse, divalidasi, dan di-stringify ulang setiap hit)                                                                        | Teks JSON dari cache (ADR 0007): riwayat 185 → 375 req/s                                                   |
| 3   | Penting     | Readiness melapor DB `down` tepat setelah boot (koneksi pertama lewat PgBouncer lambat)                                                                                  | Pool dipanaskan saat startup                                                                               |
| 4   | Penting     | Query seri bundel demo O(n²) (subquery `max()` berkorelasi). Dihentikan oleh `statement_timeout` 5 s milik role, yang berarti pengaman bekerja                           | CTE dihitung sekali                                                                                        |
| 5   | Sedang      | Impor melingkar membuat token DI `undefined`                                                                                                                             | `cache/tokens.ts`                                                                                          |
| 6   | Sedang      | Drizzle memecah array JS menjadi daftar parameter (`unnest` gagal)                                                                                                       | `sql.param()`                                                                                              |
| 7   | Sedang      | CLI bundel melaporkan "gagal" bila invalidasi cache gagal setelah bundel sudah aktif                                                                                     | Hanya peringatan (TTL membatasi kebasian)                                                                  |
| 8   | Rendah      | Alokasi IP dinamis Docker bentrok dengan IP tetap Traefik                                                                                                                | `ip_range 172.30.0.128/25`                                                                                 |
| 9   | Uji         | Timeout koneksi sesekali pada suite penuh (port proxy Docker Desktop ke PG langsung, p99 0,8 s)                                                                          | Timeout pool **uji** 15 s; API tidak terdampak                                                             |

## 5. Tinjauan independen

Hasil: **0 kritis, 4 penting**, ditambah minor. Semua yang penting, empat minor yang saya naikkan karena dampaknya, dan satu temuan tambahan saat verifikasi, diperbaiki dengan uji RED → GREEN:

| Temuan                                                                                                                                    | Perbaikan                                                                        |
| ----------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------- |
| Bundel dengan `issued_at` di masa depan tidak pernah kedaluwarsa dan mengalahkan bundel yang benar                                        | Ditolak (`future`, toleransi 5 menit)                                            |
| Ringkasan menyimpan status waktu (terlambat/kedaluwarsa/tersembunyi) di cache sampai 1 jam, sehingga bisa bertentangan dengan `/forecast` | TTL = min(1 jam, tengah malam WIB berikutnya, batas umur 8/28 hari bundel aktif) |
| `bundle:demo` menolak bundelnya sendiri bila data terakhir = hari ini                                                                     | `data_cutoff = min(akhir hari, waktu terbit)`                                    |
| Komoditas `covered` yang tidak ada di bundel tampil `available` di ringkasan                                                              | `unavailable`, sama seperti `/forecast`                                          |
| _(dinaikkan)_ Kuantil yang sebagian kosong lolos tanpa cek urutan                                                                         | Urutan nilai yang diketahui tetap dicek                                          |
| _(dinaikkan)_ Bundel lama bisa menggantikan bundel yang lebih baru                                                                        | Ditolak (`superseded`)                                                           |
| _(dinaikkan)_ Slug artikel tak dikenal di-cache 6 jam (ruang kunci dari input pengguna)                                                   | `null` tidak pernah di-cache                                                     |
| _(dinaikkan)_ Banjir log per permintaan saat Valkey mati                                                                                  | Peringatan dibatasi 1/10 detik per jenis, jumlah yang ditahan dilaporkan         |
| _(verifikasi)_ ID bundel demo tanpa waktu terbit, sehingga penyegaran demo selalu `already_known`                                         | ID memuat cap waktu terbit                                                       |

**Minor yang ditunda** (dicatat untuk fase berikutnya):

1. Verifier belum mewajibkan 8 horizon lengkap per komoditas.
2. Batas besaran perubahan hanya ditegakkan oleh DB (galat buram; bundel aktif tetap aman).
3. Penghitung rate limit berbagi Valkey cache `allkeys-lru` (bisa terhapus saat memori penuh).
4. Pemanggil yang bergabung (single-flight) ikut menunggu `SET` cache.
5. Satu cast `as CommodityCode` di CLI bundel.
6. Seed artikel memperbarui `updated_at` setiap run, tidak menginvalidasi cache artikel, dan tidak menyembunyikan berkas yang dihapus.
7. `/forecast` berstatus `unavailable` masih membawa `artifact`.
8. Uji integrasi API dan pytest ingest berbagi `kawanpasar_test`, sehingga tidak boleh dijalankan bersamaan (`audit:all` menjalankannya berurutan).

## 6. Run audit terakhir

Run final setelah semua perbaikan (12 Nov 2026, tanpa proses lain berjalan): **13/13 gerbang lulus**: format, lint, typecheck, unit, infra (17 pemeriksaan), integrasi API (94), reset DB uji, ingest pytest (54, cakupan ±97%), mypy strict, ruff, audit dependensi (0 kerentanan), pemindaian `any`, dan pemindaian atribusi AI. Simulasi pemanggil terhadap kontainer API sungguhan (21 skenario valid, tidak valid, dan tanpa token) sesuai dengan `docs/api/v1.md`.

## 7. Catatan untuk pemilik

1. **Tinjau 5 draf artikel** di `content/articles/` (status `draft`), lalu ubah ke `published` bila setuju (`docs/product/konten-artikel.md`).
2. Bundel demo berumur 8/28 hari. Jalankan `pnpm --filter @kawan-pasar/api bundle:demo` bila label kedaluwarsa muncul di lingkungan dev.
3. Sasaran p95 dipindahkan ke Fase 1D (§3).
4. Semua perubahan belum di-commit. Usulan urutan commit diberikan terpisah.
