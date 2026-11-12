# Changelog

Format mengikuti [Keep a Changelog](https://keepachangelog.com/id-ID/1.1.0/). Versi produk mengikuti fase pengembangan.

## [Fase 1A — API publik] — 2026-11-12

### Ditambahkan

- Paket `@kawan-pasar/contracts`: skema Zod bersama untuk respons dan kueri API, serta bundel prediksi.
- Endpoint `/v1/markets`, ringkasan harga, riwayat (30h/90h/1t/semua), prediksi 8 horizon, artikel; `POST /internal/cache/invalidate`.
- Token layanan, rate limit Valkey per klien, proxy tepercaya eksplisit, filter galat seragam.
- Cache Valkey dengan single-flight; respons besar disajikan sebagai teks JSON dari cache (ADR 0007).
- Verifikasi dan promosi bundel prediksi (`bundle:promote`), bundel demo berlabel (`bundle:demo`, ADR 0006).
- Artikel edukasi berbasis Markdown (`content/articles`, `db:seed:articles`): 1 terbit, 5 draf.
- Uji beban k6 (`tests/load`), ADR 0005–0007, `docs/api/v1.md`, laporan `docs/audits/fase-1a.md`.

### Diperbaiki

- Log permintaan API yang ternyata nonaktif sejak Fase 0 kini aktif, dengan redaksi header yang teruji.
- p95 di bawah beban turun dari 9,75 s menjadi 378 ms (laptop dev, 1 replika); 0% galat.
- Readiness tidak lagi palsu `down` setelah boot; query seri bundel demo O(n²) diperbaiki.
- Aturan bundel: waktu terbit di masa depan, bundel lebih lama, dan kuantil sebagian kosong kini ditolak dengan benar.
- Ringkasan harga tidak lagi bertentangan dengan `/forecast` saat bundel melewati batas 8/28 hari.
- Bawaan Fase 0: `trustProxy`, nomor baris di log ingest, overflow seed, CHECK batas harga/tanggal.

## [Fase 0 — Fondasi] — 2026-11-11

### Ditambahkan

- Monorepo pnpm 11 + Turborepo; preset TypeScript 6.0 strict (`@kawan-pasar/tsconfig`) dan konfigurasi ESLint bersama yang melarang `any` dan penekanan galat tipe (`@kawan-pasar/eslint-config`).
- Paket `@kawan-pasar/catalog`: 5 komoditas, 4 pasar, 8 horizon prediksi.
- Infrastruktur lokal Docker Compose: Traefik v3.7 (header keamanan, rate limit, batas body, kompresi; tanpa socket Docker), PostgreSQL 18, PgBouncer (transaction pooling, SCRAM via `auth_query`), Valkey 9 dua instance (cache LRU dan antrean tanpa eviction). Semua port dev hanya di `127.0.0.1`.
- Skema database (Drizzle) dengan constraint aturan produk: harga > 0, horizon tertutup, kuantil monoton, satu bundel aktif per model. Materialized view `mv_latest_prices` dan role berhak minimum (`app_rw`, `ingest_w`, `pgbouncer_auth`).
- Core API NestJS 12 (Fastify): validasi env Zod yang gagal cepat tanpa membocorkan nilai, health `live`/`ready`, helmet dengan CSP `default-src 'none'`, request id dari server, logging pino dengan redaksi, dan image Docker non-root.
- Layanan ingest Python 3.14: impor CSV seed dengan validasi ketat, upsert idempoten per batch, pencatatan `ingest_runs`, dan refresh view harga terakhir. Dataset seed 5.859 baris berhasil diimpor.
- Kerangka `services/model-arifnet` dan kontrak bundel prediksi + HMAC (belum dikembangkan).
- Skrip `pnpm env:init`, `infra:up/down/check`, `ingest:import`, dan `audit:all`.
- Dokumentasi: desain, rencana, ADR 0001–0004, kamus data, katalog, dataset, kontrak bundel, keamanan dependensi, strategi uji, cara menjalankan lokal, dan audit Fase 0.

### Diperbaiki (audit & tinjauan independen Fase 0)

- API tidak lagi crash saat PgBouncer/PostgreSQL restart (listener `error` pada pool `pg`).
- Readiness tidak lagi melapor cache `down` sesaat setelah boot; CSP API dikunci ke `default-src 'none'`.
- Run ingest selalu ditutup (`failed` beserta alasan) pada galat apa pun; refresh view berjalan terpisah; CLI menampilkan alasan galat.
- Validasi ingest diperketat: harga hanya digit rupiah utuh (Rp100–Rp10.000.000; `40.000` ditolak), tanggal hanya `YYYY-MM-DD` mulai 2000-01-01.
- Role `app_rw` tidak lagi boleh memicu refresh view (migrasi `0002`).
- Koneksi database diberi batas waktu (ingest, uji, audit); `scripts/compose.mjs` mencegah kontainer dibuat ulang tanpa port dev; `infra-check` memeriksa kelengkapan port.
- Skrip pemeriksa infra tidak lagi mencetak rahasia; override keamanan dev-only untuk `minimatch` dan `esbuild`.
