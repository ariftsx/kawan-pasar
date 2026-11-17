# Fase 1D — Kinerja, Beban, dan Replika: Rencana Implementasi

**Status:** selesai (17 Nov 2026) — audit `docs/audits/fase-1d.md`.

**Tujuan:** Membuktikan bahwa situs publik cepat dan tahan beban:

- Lighthouse di profil 4G memenuhi anggaran desain.
- Uji beban k6 lewat Traefik → web → API menunjukkan galat rendah dan database tidak tersentuh oleh pengunjung.
- Web berjalan dengan 2 replika di belakang Traefik dengan cache halaman bersama di Valkey.
- Sasaran terbuka dari Fase 1A (p95) diukur ulang dengan pembagian CPU yang jelas.

**Arsitektur:**

- Next.js memakai `cacheHandler` buatan sendiri yang menyimpan cache ISR dan cache data fetch di Valkey cache (database terpisah), dengan `cacheMaxMemorySize: 0`.
- Dua kontainer web (`web-1` 172.30.0.10, `web-2` 172.30.0.11) di-load-balance Traefik (round-robin + health check).
- Revalidasi tag cukup sekali karena cache dipakai bersama.
- Uji beban memakai overlay compose khusus yang membatasi CPU: tumpukan 3 vCPU, k6 1 vCPU.

**Tech stack:** sama dengan 1C, ditambah `ioredis` di web (versi yang sudah dipakai API), `lighthouse` (dev, `tests/perf`), dan `grafana/k6:2.3.0` (sudah dipakai di 1A).

**Spec:** `docs/design/2026-11-11-kawan-pasar-design.md` §3 (NFR), §6.1 (replika), §6.2, §11. Audit 1A §3, audit 1B §5, audit 1C §5. ADR 0005, 0007, 0009.

**Keputusan pemilik (13 Nov 2026):**

1. k6 dijalankan **di laptop ini dengan CPU dibatasi** (tumpukan 3 vCPU, k6 1 vCPU). Angka dilaporkan sebagai batas bawah untuk mesin kecil.
2. Replika web memakai **cache bersama di Valkey**.

## Batasan global

- Semua batasan Fase 0–1C tetap berlaku.
- **Anggaran NFR (desain §3, §11), diukur Lighthouse profil seluler bawaan (simulasi 4G lambat, CPU 4×):**
  - LCP ≤ 2,5 detik dan CLS < 0,1.
  - TBT ≤ 200 ms sebagai pengganti INP di uji lab (INP butuh interaksi nyata).
  - JS awal ≤ 170 KB terkompresi.
- **Sasaran beban (desain §11):** 500 pengguna virtual menjelajah halaman publik selama 5 menit dengan galat < 0,5% dan p95 < 500 ms. Uji lonjakan dan uji bahwa rate limit memotong klien rakus dengan 429, bukan menjatuhkan server.
- **Cache bersama bersifat fail-open.** Valkey mati → web tetap melayani dengan merender langsung (lebih lambat), tanpa 500 dan tanpa banjir log.
- Tidak ada data sensitif di cache halaman (halaman publik saja). Kunci cache web memakai awalan sendiri di database Valkey terpisah dari API.

## Fokus tinjauan

1. **Konsistensi antarreplika.** Halaman yang dirender `web-1` dilayani dari cache oleh `web-2`. Revalidasi yang diterima satu replika membuat **kedua** replika menyajikan data baru (Task 1–2).
2. **Valkey mati atau lambat.** Web tetap 200 dengan render langsung; operasi cache diberi batas waktu; pulih tanpa restart (Task 1).
3. **Serialisasi entri cache.** Payload RSC (biner), map segmen, header, dan status 404 harus kembali utuh. Halaman dari cache tidak boleh rusak atau kosong (Task 1).
4. **Satu replika mati.** Traefik mengalihkan semua permintaan ke replika yang hidup tanpa galat yang terlihat pengunjung (Task 2, uji di Task 4).
5. **Uji beban yang jujur.**
   - Pengguna virtual tidak boleh terbentur rate limit tepi saat mengukur kapasitas.
   - Rate limit tetap diuji terpisah dengan konfigurasi asli.
   - Laporan menyebut pembagian CPU dan bahwa angka adalah batas bawah (Task 3–4).

---

### Task 1: Cache handler Valkey untuk Next.js

**Files:**

- Create: `apps/web/src/cache/valkey-cache-handler.ts` (+ titik masuk JS hasil build untuk `next.config`), `apps/web/src/cache/serialize.ts`
- Modify: `apps/web/next.config.ts` (`cacheHandler`, `cacheMaxMemorySize: 0`), `apps/web/package.json` (`ioredis`), `apps/web/src/lib/env.ts` (`VALKEY_WEB_CACHE_URL` opsional)
- Test: `apps/web/src/cache/*.test.ts` (unit dengan Valkey tiruan dan Valkey asli database 15)

**Interfaces (Produces):**

- Kelas `CacheHandler` sesuai kontrak Next 16: `get(key, ctx)`, `set(key, data, ctx)`, `revalidateTag(tags, durations?)`, `resetRequestCache()`.
- **Penyimpanan:** `kp:web:v1:entry:<key>` berisi `{lastModified, cacheControl, tags, value}`, diserialisasi dengan format yang menjaga `Buffer` dan `Map` (diuji pulang-pergi untuk setiap jenis nilai: `APP_PAGE`, `APP_ROUTE`, `FETCH`, 404).
- **Masa simpan:** `expire` dari `cacheControl`, ditambah batas atas 7 hari. Valkey `allkeys-lru` menjadi pengaman memori.
- **Revalidasi tag:**
  - `revalidateTag` menulis `kp:web:v1:tag:<tag>` = waktu revalidasi.
  - `get` membandingkan waktu tag entri (termasuk tag implisit halaman) dengan `lastModified`. Bila lebih baru, entri dianggap basi: dikembalikan sebagai basi (sesuai profil `max`) atau kosong (sesuai durasi).
  - Satu `MGET` per `get` untuk semua tag, bukan N query.
- **Fail-open:** setiap operasi dibatasi 200 ms. Bila galat atau timeout: `get` → `null` (render langsung), `set` dan `revalidateTag` → dicatat terbatas (`ThrottledWarning`).
- Tanpa `VALKEY_WEB_CACHE_URL` (dev, uji), Next memakai cache bawaan dan perilaku Fase 1C tidak berubah.

- [ ] **Step 1:** Uji:
  - Pulang-pergi serialisasi untuk setiap jenis nilai (biner identik).
  - Instans A `set` → instans B `get` mengembalikan entri yang sama.
  - Setelah `revalidateTag('prices:PIKJ')` di instans B, `get` di instans A mengembalikan entri sebagai basi.
  - Valkey tak terjangkau → `get` `null` dalam ≤ 250 ms, tanpa _throw_, dan maksimal 1 peringatan per 10 detik.
  - Tag implisit halaman ikut dicek.
- [ ] **Step 2:** GAGAL → **Step 3:** implementasi → **Step 4:** LULUS.
- [ ] **Step 5 — Checkpoint (pemilik):** `feat(web): cache isr dan data bersama di valkey`

### Task 2: Dua replika web di belakang Traefik

**Files:** `infra/compose/docker-compose.yml`, `infra/traefik/dynamic/routes.yml`, `scripts/infra-check.mjs`, `scripts/gen-env.mjs` (tidak ada rahasia baru; web memakai `VALKEY_PASSWORD` yang sudah ada), `docs/operations/menjalankan-lokal.md`

- `web-1` (172.30.0.10) dan `web-2` (172.30.0.11) memakai image yang sama.
  - Env `VALKEY_WEB_CACHE_URL=redis://:…@valkey-cache:6379/1`.
  - Tanpa `depends_on api: healthy` (minor 1B #5): web bisa start dan menyajikan halaman statis tanpa API.
- API: `TRUSTED_PROXY_IPS=172.30.0.10,172.30.0.11`. `WEB_INTERNAL_URL` tetap satu (`http://web-1:3000`): cache bersama membuat satu revalidasi cukup. Bila `web-1` mati, revalidasi gagal dan cukup dicatat (TTL membatasi).
- Traefik: layanan `web` dengan 2 server dan health check.
- `mem_limit` dan `pids_limit` untuk `web-*` dan `api` (minor 1B #5).
- **Pemeriksaan infra baru:**
  - Kedua replika sehat.
  - Permintaan beruntun ke `/` mengenai keduanya (header respons diagnostik `x-kp-replica` hanya di overlay dev).
  - Halaman yang dirender `web-1` → `HIT` di `web-2` (uji langsung ke masing-masing lewat jaringan backend).
  - Revalidasi lewat API → kedua replika menyajikan versi baru.

- [ ] **Step 1:** Tambahkan pemeriksaan ke `infra-check` → GAGAL → **Step 2:** implementasi → LULUS.
- [ ] **Step 3:** Matikan `web-2` → `pnpm --filter @kawan-pasar/e2e e2e` (subset perjalanan) tetap lulus → hidupkan lagi.
- [ ] **Step 4 — Checkpoint (pemilik):** `feat(infra): dua replika web dengan cache bersama dan batas sumber daya`

### Task 3: Overlay uji beban dan skenario k6 lewat halaman

**Files:**

- Create: `infra/compose/docker-compose.loadtest.yml`, `infra/traefik/dynamic-loadtest/` (salinan middleware dengan rate limit tepi dinaikkan, hanya untuk overlay), `tests/load/web-browse.js`, `tests/load/web-spike.js`, `tests/load/edge-rate-limit.js`, `scripts/loadtest.mjs`
- Modify: `tests/load/api-public.js` (IP penguji 172.30.0.12 yang hanya dipercaya di overlay), `docs/testing/uji-beban.md`

- **Overlay `loadtest`:**
  - `cpus`: postgres 0,5; pgbouncer 0,25; valkey-cache 0,25; api 0,75; web-1 0,5; web-2 0,5; traefik 0,25 (total 3). Kontainer k6 `cpus: 1`.
  - Traefik memakai direktori dinamis `dynamic-loadtest`, dengan rate limit tepi setinggi kapasitas uji. Hanya uji kapasitas yang memakainya.
- **`web-browse.js`:** 500 VU × 5 menit, naik 30 detik. Setiap iterasi meniru jelajah:
  - Beranda → Harga → Detail (komoditas acak dari 5) → Prediksi (acak dari 3) → Edukasi/Artikel, dengan jeda berpikir 1–3 detik.
  - Juga memuat aset JS halaman (dari HTML) agar Traefik dan brotli ikut teruji.
  - Ambang: `http_req_failed < 0.5%`, `p(95) < 500 ms`, `checks > 99%`.
- **`web-spike.js`:** 0 → 800 VU dalam 10 detik, tahan 60 detik, turun. Ambang: tanpa 5xx dari web/API (429 dari tepi diizinkan dan dihitung terpisah), pulih ke p95 normal dalam 30 detik setelah lonjakan.
- **`edge-rate-limit.js`:** konfigurasi Traefik **asli**. Satu klien 200 req/s selama 10 detik → mayoritas 429; klien lain tetap 200.
- **`scripts/loadtest.mjs`** (satu perintah):
  1. Naikkan overlay dan kosongkan cache.
  2. Catat `pg_stat_database` (transaksi), jumlah permintaan API (log), dan statistik Valkey sebelum uji.
  3. Jalankan skenario, lalu catat lagi sesudahnya.
  4. Tulis ringkasan JSON ke `.audit/loadtest-*.json`.
- **Rasio:** permintaan halaman : panggilan API : transaksi DB. Sasarannya, transaksi DB tidak tumbuh mengikuti jumlah pengunjung.

- [ ] **Step 1:** Jalankan skenario terhadap tumpukan 1C (1 replika, tanpa cache bersama) sebagai **baseline** dan catat hasilnya.
- [ ] **Step 2:** Jalankan terhadap tumpukan 1D (2 replika + cache bersama), lalu bandingkan.
- [ ] **Step 3:** Ulangi `api-public.js` (sasaran terbuka 1A: p95 < 100 ms) dengan pembagian CPU yang sama.
- [ ] **Step 4 — Checkpoint (pemilik):** `test(load): uji beban halaman lewat traefik dengan pembagian cpu tetap`

### Task 4: Lighthouse (kinerja di profil 4G) dan perbaikan yang ditemukan

**Files:** `tests/perf/{package.json,lighthouse.mjs,budgets.json}`, `scripts/audit.mjs` (gerbang `lighthouse`), perbaikan di `apps/web` sesuai temuan

- Lighthouse 13 (dev) berjalan dengan Chromium milik Playwright (`CHROME_PATH`) terhadap `:8080`, profil seluler bawaan.
- **Halaman:** `/`, `/beranda`, `/harga`, `/harga/cabai-merah-keriting`, `/prediksi`, `/edukasi/apa-itu-inflasi-pangan`, `/arif-net`.
- Tiap halaman diukur 3 kali; median dibandingkan dengan `budgets.json`: LCP ≤ 2500 ms, CLS < 0,1, TBT ≤ 200 ms, skrip ≤ 170 KB, skor aksesibilitas = 100.
- **Kandidat perbaikan** (hanya bila diukur gagal):
  - preload font Geist Mono di halaman berangka besar;
  - ukuran awal SVG Kapa dan ilustrasi di atas lipatan (CLS);
  - menunda `ChartTooltip`/`Switch` (hidrasi lebih ringan);
  - memecah chunk `react-markdown` (hanya server; pastikan tidak ikut ke klien).

- [ ] **Step 1:** Jalankan → catat baseline. **Step 2:** perbaiki halaman yang gagal (setiap perbaikan diukur ulang). **Step 3:** gerbang `lighthouse` lulus.
- [ ] **Step 4 — Checkpoint (pemilik):** `perf(web): anggaran lighthouse 4g`

### Task 5: Minor tertunda yang relevan dengan kinerja dan ketahanan

| Asal  | Minor                                                      | Perbaikan                                                                         |
| ----- | ---------------------------------------------------------- | --------------------------------------------------------------------------------- |
| 1B #1 | Route revalidasi membaca seluruh body sebelum cek 8 KiB    | Tolak `content-length` > 8 KiB lalu baca stream dengan batas                      |
| 1B #3 | Respons 200 yang melanggar kontrak tersimpan di cache data | Fetch dengan `no-store` ulang + revalidasi tag terkait saat kontrak gagal (uji)   |
| 1B #6 | Env web baru divalidasi saat render pertama                | Validasi di `instrumentation.ts` `register()`; `/api/health` gagal bila env salah |
| 1C #1 | Komentar `ageDays` di ringkasan tidak akurat               | Komentar dan `docs/api` diselaraskan                                              |
| 1C #2 | Daftar isi artikel: tautan, judul ganda, `##` di blok kode | `headingsOf` dari pohon Markdown yang sama dengan renderer; id unik               |
| 1C #6 | Pencarian komoditas tanpa hasil diam saja                  | Pesan "Tidak ada komoditas yang cocok" (`role="status"`)                          |

Setiap perbaikan RED → GREEN. Checkpoint: `fix: minor tertunda fase 1b dan 1c`

### Task 6: Dokumentasi dan audit Fase 1D

**Files:** `docs/architecture/adr/0010-cache-bersama-dan-replika-web.md`, `docs/testing/uji-beban.md` (hasil 1A vs 1D, pembagian CPU, cara mengulang), `docs/testing/strategi-uji.md`, `docs/operations/menjalankan-lokal.md`, `CHANGELOG.md`, `docs/audits/fase-1d.md`

- [ ] `pnpm audit:all` (gerbang baru `lighthouse`) → semua lulus.
- [ ] Tinjauan independen (model paling mampu) dengan Fokus tinjauan di atas → perbaikan RED → GREEN.
- [ ] Laporan memuat tabel 1A → 1D (p95, galat, transaksi DB per 1.000 permintaan, Lighthouse per halaman), pembagian CPU, dan batasan pengukuran.
- [ ] Checkpoint: `docs: uji beban, lighthouse, dan audit fase 1d`

## Di luar lingkup Fase 1D

- Penerapan produksi (Swarm, Cloudflare Tunnel, HSTS, HTTP/3).
- Pengukuran dari perangkat di LAN (opsi yang tidak dipilih); bisa dilakukan kapan saja dengan skrip yang sama.
- Akun, peringatan, dan analis (Fase 2–3).
