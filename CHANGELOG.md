# Changelog

Format mengikuti [Keep a Changelog](https://keepachangelog.com/id-ID/1.1.0/). Versi produk mengikuti fase pengembangan.

## [Fase 3A — Mode Analis] — 2026-11-23

### Ditambahkan

- **Mode Analis** di `/analis`, terbuka untuk semua:
  - grafik perbandingan antarkomoditas (indeks, harga, perubahan relatif) dengan rentang 90H, 1T, 3T, dan Semua;
  - unduh grafik PNG dengan judul, legenda, dan sumber;
  - kartu cakupan data dan tabel perkiraan ARIF-Net (7, 30, 90, 365 hari).
- **Unduhan CSV** `harga.csv` dan `prediksi.csv` untuk peran Analis: filter komoditas dan tanggal, 30 unduhan per jam, tercatat di `audit_log`.
- **Pengajuan peran Analis** di `/akun` (bagian "Mode Analis"). Untuk sementara diputuskan lewat `pnpm --filter @kawan-pasar/api role:grant <email> analyst|user`; halaman admin menyusul di Fase 3B.
- Kode galat `forbidden` (403).
- Migrasi `0010_analyst`: peran pengguna, `analyst_requests`, `audit_log`, dan `prune_audit_log()`.
- Tautan Mode Analis di Lainnya, footer, ARIF-Net, dan Prediksi.

## [Fase 2C — WhatsApp (adapter tiruan)] — 2026-11-19

### Ditambahkan

- **WhatsApp** di `/peringatan` (ADR 0013):
  - hubungkan nomor dengan kode 6 digit, lalu status "Peringatan WhatsApp aktif!";
  - kabar peringatan (digabung per evaluasi) dan ringkasan mingguan juga dikirim ke WhatsApp, maks 5 pesan per hari;
  - balas STOP untuk berhenti; aktif lagi lewat verifikasi ulang;
  - meta kabar "juga dikirim ke WhatsApp".
  - Adapter tiruan mengirim ke Mailpit. Simulasikan balasan dengan `pnpm wa:balas <nomor> <teks>`.
- Rotasi kunci nomor HP (`phone_key_id`, `PHONE_ENC_KEY_PREVIOUS`).
- Migrasi `0008_phone_key` dan `0009_whatsapp`.

### Diperbaiki

- Batas 20 pantauan kini atomik (permintaan paralel tidak bisa melewatinya).
- `model-export`: masukan baca-saja, keluaran di folder sendiri. Berkas harga tidak lagi tertinggal saat sebuah langkah gagal.
- Nomor HP yang gagal didekripsi kini dilaporkan, tidak hilang diam-diam.

## [Fase 2B — ARIF-Net, peringatan, dan kabar] — 2026-11-19

### Ditambahkan

- **ARIF-Net A0 (v1.1.0) di produk** (ADR 0012):
  - inferensi numpy di `services/model-arifnet` (setara kode riset, dibuktikan uji golden);
  - bobot `.npz` tanpa pickle, diperiksa sha256;
  - kontainer sekali jalan `model-export` tanpa jaringan dan database;
  - `pnpm model:export` (ekspor harga → bundel → promosi).
  - Halaman Prediksi kini memakai ARIF-Net (bukan data demo). Status uji "Sebagian" untuk sel yang di validasi tidak lebih baik dari "harga tetap".
  - Halaman ARIF-Net dan Keterbatasan memuat skor validasi v1.1, tabel per komoditas × horizon, dan catatan uji prospektif.
- **Peringatan** (`/peringatan`, prototipe d_peringatan):
  - daftar pantau komoditas dengan batas harga sendiri;
  - tiga aturan: pergerakan di luar kebiasaan, prediksi naik > 2% (hanya dari model nyata), harga melewati batas;
  - kabar di aplikasi dengan tab Semua / Belum dibaca / Ringkasan mingguan dan "Tandai semua dibaca";
  - evaluasi berkelompok di worker setelah impor harga atau promosi bundel (jumlah kueri tetap, idempoten per tanggal data);
  - ringkasan mingguan Senin 06.00 WIB di aplikasi dan email, dengan tautan berhenti berlangganan satu klik (`/berhenti-ringkasan`).
- **Akun:**
  - nomor HP opsional (terenkripsi AES-256-GCM, ditampilkan tersamar, bisa diubah/dihapus di `/akun`);
  - konfirmasi kata sandi;
  - tombol lihat/sembunyikan di semua isian kata sandi.
- Migrasi `0006_user_phone`, `0007_alerts`. Rahasia baru `PHONE_ENC_KEY` (`gen-env --add-missing`).
- Gerbang audit baru: `model-tests`, `model-mypy`, `model-ruff`; `infra-check` memeriksa isolasi `model-export` (40 pemeriksaan).

### Diubah

- Retensi kabar di aplikasi: 180 hari (`/privasi`).
- CLI bundel keluar dengan `process.exitCode` (sebelumnya `process.exit` dapat memicu assertion libuv di Windows setelah promosi berhasil).

### Keamanan

- Tautan kabar hanya boleh path produk; `//host` ditolak di kontrak dan CHECK database.
- Advisory `picomatch` GHSA-fc5q-39xc-vjpf dicabut GitHub (18 Nov 2026): tidak ada pengecualian audit.

## [Fase 2A — Akun dan keamanan] — 2026-11-18

### Ditambahkan

- **Akun dengan email dan kata sandi:**
  - daftar dan verifikasi email (wajib sebelum peringatan);
  - masuk dan keluar;
  - lupa, atur ulang, dan ganti kata sandi;
  - sesi aktif (lihat dan cabut);
  - hapus akun.
  - Halaman: `/masuk`, `/daftar`, `/lupa-sandi`, `/atur-ulang-sandi`, `/verifikasi-email`, `/akun`, `/privasi`.
- **Keamanan:**
  - Argon2id (OWASP) dengan batas kapasitas hash.
  - Daftar sandi bocor.
  - Sesi hanya sebagai hash di `valkey-session` (noeviction).
  - Lockout bertahap dan rate limit akun.
  - Token email sekali pakai.
  - Token CSRF per sesi.
  - Cookie `__Host-`.
  - CSP ber-nonce di halaman akun (ADR 0011).
  - Jawaban yang tidak membocorkan keberadaan akun.
- **Infrastruktur:** `valkey-session`, Mailpit (lokal), `worker` (antrean email BullMQ dan retensi data akun 90 hari). Rahasia baru `AUTH_SECRET` (`gen-env --add-missing`).
- **Uji:**
  - Integrasi API: akun, worker↔Mailpit, retensi, kapasitas hash, log galat.
  - E2E perjalanan akun dan keamanan (total 292 uji).
  - Uji beban banjir login.

### Diperbaiki

- Traefik menimpa `Referrer-Policy` halaman. Kini halaman bertoken tetap `no-referrer`.
- Penghapusan cookie `__Host-` tanpa `Secure` diabaikan browser, sehingga sesi tidak benar-benar keluar di sisi browser.
- Galat database tak terduga mencatat parameter kueri (alamat email) ke log. Kini hanya jenis galat dan kode.
- Tinjauan independen:
  - Token email tidak lagi tercatat di log akses Traefik.
  - "Lupa sandi" tidak lagi membedakan alamat lewat waktu jawaban (diselesaikan worker).
  - Sesi yang dicabut tidak bisa hidup lagi lewat penulisan "terakhir dilihat".
  - Masuk ulang mengakhiri sesi lama.
- Navigasi desktop tetap satu baris di 1280 px.

## [Fase 1D — Kinerja, beban, dan replika] — 2026-11-17

### Ditambahkan

- **Cache halaman dan data bersama di Valkey** (`apps/web/src/cache`, ADR 0010), dipakai dua replika web.
  - Kesegaran mengikuti aturan tag Next.js sendiri.
  - Fail-open dengan batas 200 ms per operasi.
  - Entri dibatasi per build.
- **Dua replika web** (`web-1`, `web-2`) di belakang Traefik.
  - Round-robin, health check, dan `retry` saat satu replika mati.
  - `mem_limit` dan `pids_limit` untuk web dan API.
  - Web tidak lagi menunggu API saat start.
- **Kompresi per jenis respons di tepi:** gzip untuk halaman, brotli untuk aset statis.
- **Uji beban dengan CPU dibatasi:** `scripts/loadtest.mjs` (overlay `docker-compose.loadtest.yml`), dengan skenario `web-browse`, `web-spike`, `edge-rate-limit`, dan `api-public`.
- **Anggaran Lighthouse:** `tests/perf` mengukur profil seluler 4G (LCP, CLS, TBT, JS, aksesibilitas) dan menjadi gerbang `lighthouse` di `pnpm audit:all`.
- **Uji integrasi cache web** terhadap Valkey asli (database 14).
- **Pemeriksaan infra baru:**
  - pembagian beban ke kedua replika;
  - HIT lintas replika;
  - revalidasi lintas replika;
  - entri per build;
  - tidak ada pustaka validasi di bundel browser.

### Diperbaiki

- Zod (±30 KB terkompresi) ikut terkirim ke browser di setiap halaman data. `FreshnessNotice` kini mengimpor `@kawan-pasar/contracts/staleness`, sehingga JS halaman data turun dari 175 KB menjadi 144 KB.
- Halaman build lama bisa tersaji setelah deploy bila cache dibagi. Sekarang entri dibatasi `BUILD_ID`.
- Payload tooltip grafik memakai presisi penuh. Posisi kini dibulatkan 0,1%, dan `/harga` turun dari 242 KB menjadi 222 KB.
- Urutan judul (axe `heading-order`) di Beranda (sorotan mingguan) dan grafik riwayat harga.
- Route revalidasi tidak lagi membaca body tanpa batas: panjang > 8 KiB ditolak sebelum dibaca, dan body tanpa panjang dihentikan di 8 KiB.
- `/api/health` memvalidasi env server, sehingga replika yang salah konfigurasi langsung tidak sehat.
- Daftar isi artikel: tautan, judul ganda, dan `##` di blok kode.
- Pencarian komoditas tanpa hasil kini menampilkan pesan.

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
