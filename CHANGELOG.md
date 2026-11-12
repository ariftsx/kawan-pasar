# Changelog

Format mengikuti [Keep a Changelog](https://keepachangelog.com/id-ID/1.1.0/). Versi produk mengikuti fase pengembangan.

## [Fase 1C — Halaman publik] — 2026-11-13

### Ditambahkan

- Seluruh halaman publik v0.4 dengan data nyata: Beranda Publik (orientasi), Beranda, Harga, Detail komoditas, Prediksi (8 horizon), Edukasi, Artikel, ARIF-Net, Keterbatasan, Pilih Pasar, dan Lainnya.
- Grafik SVG yang dirender server, tanpa library:
  - Riwayat harga (30 hari, 90 hari, 1 tahun, semua) dan grafik prediksi (aktual, median, rentang 80%, hari dasar).
  - Pilihan rentang dan horizon hanya mengganti varian yang sudah ada di HTML.
  - Tooltip dengan papan ketik; ringkasan teks dan tabel data sebagai alternatif.
- Logika tampilan sebagai fungsi yang diuji:
  - Kartu "paling naik/turun", Kata Kapa berbasis fakta data (kata kausal dan beli/jual ditolak uji), perubahan 1/7/30/90 hari tanpa interpolasi, dan tampilan prediksi.
  - Prediksi tersembunyi atau tidak tersedia tidak menampilkan angka di mana pun.
- API: ringkasan harga membawa `forecastArtifact` (versi model untuk setiap prediksi 7 hari). Aturan "terlambat" dipindah ke `@kawan-pasar/contracts` agar API dan web memakai definisi yang sama.
- `FreshnessNotice`: halaman dari cache tetap memperingatkan bila data sudah lewat 2 hari kerja.
- Artikel Markdown dirender dengan `react-markdown` di server (HTML mentah diabaikan, daftar putih elemen, URL aman), lengkap dengan daftar isi dan contoh harga dari data nyata.
- Orientasi kunjungan pertama dengan cookie fungsional `kp_onboarded` (`docs/security/cookie-dan-privasi.md`), URL kanonik, sitemap, dan robots.
- Uji e2e: perjalanan pengguna di 360/1280 px, aturan produk di semua halaman, tanpa JavaScript, dan seluruh halaman di 6 lebar layar, teks 200%, reflow 320 px, serta axe.

### Diperbaiki

- **Uji integrasi API berbagi Valkey database 0 dengan API dev.** Data uji (bundel prediksi uji non-demo) sempat tersaji di dev tanpa label "Data demo". Uji kini memakai database 15.
- Penjaga banjir path (`proxy.ts`) kini juga berjalan untuk URL publik, karena proxy melihat URL sebelum rewrite.
- Health check Traefik ke web yang terlalu ketat mengubah kelambatan CPU menjadi 503 untuk semua permintaan (satu replika).
- Tata letak sempit dan teks 200%: grid default `minmax(0,1fr)`, containing block untuk teks `sr-only` di kontainer gulir, tabel lebar di region gulir yang bisa difokus, dan harga besar memakai `clamp()`.

## [Fase 1B — Fondasi web] — 2026-11-12

### Ditambahkan

- Paket `@kawan-pasar/tokens`: palet Brand v0.4, skala tipe, spasi, radius, dan gerak sebagai satu sumber untuk `@theme` Tailwind 4. Kontras AA diuji, dan tiga varian teks gelap ditambahkan untuk teks kecil.
- `apps/web` (Next.js 16.4, React 19.3, Tailwind 4.3):
  - Font Plus Jakarta Sans dan Geist Mono di-self-host (subset WOFF2, OFL).
  - Env tervalidasi; CSP hibrida (ADR 0008).
- Brand:
  - Logo, 5 ikon komoditas, 19 ikon fitur, 4 ilustrasi (SVG inline).
  - Maskot Kapa 7 pose dengan animasi CSS (melayang, gestur, berkedip) yang dijeda di luar layar dan mati di `prefers-reduced-motion`.
- Komponen atomik v0.4 (atom, molekul, organisme, template):
  - Kerangka responsif: NavBar desktop, TopBar + TabBar mobile, Footer.
  - Status sistem publik: prediksi menyusul, pasar belum tersedia, harga terlambat, gagal memuat, segera hadir.
- Klien API server-only:
  - Validasi ganda dengan `@kawan-pasar/contracts` dan cache data bertag.
  - Galat upstream tidak pernah di-cache ISR.
  - Rute data per pasar (`/[market]/…` + rewrites + penjaga `proxy.ts`); `/pasar` sebagai halaman data pertama.
- Revalidasi bertag: API → `POST /api/internal/revalidate` (token tersendiri), dipicu invalidasi cache dan promosi bundel (ADR 0009). Nama tag dibagi lewat `cacheTags` di `@kawan-pasar/contracts`.
- Rate limit API: ember `internal` untuk render server web (1200/menit), terpisah dari batas per pengunjung (120/menit).
- Kontainer `web`:
  - Di 172.30.0.10, non-root, read-only, dengan tmpfs terbatas untuk cache ISR.
  - Router Traefik ke web; `/api/internal/*` diblokir dari luar; kompresi brotli di Traefik.
- Uji asap e2e Playwright + axe (`tests/e2e`):
  - 6 lebar layar dan reflow 320 px.
  - WCAG 2.2 AA, gerak dikurangi, dan anggaran JS (≈136 KB dari 170 KB).
- `gen-env --add-missing`, gerbang audit baru (`web-build`, `stack-rebuild`, `e2e-smoke`), dokumentasi `docs/design-system/`, ADR 0008–0009, dan laporan `docs/audits/fase-1b.md`.

### Diperbaiki

- Cache `tsx` (`apps/api/undefined/…`) yang ikut ter-commit di Fase 0 dihapus dan diabaikan. Isinya hanya kode sumber hasil transpilasi, tanpa rahasia.
- `.prettierignore` mengabaikan setiap folder bernama `data` di level mana pun. Sekarang hanya `/data/` di root; dokumen `docs/data/*` kini ikut diformat.

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
