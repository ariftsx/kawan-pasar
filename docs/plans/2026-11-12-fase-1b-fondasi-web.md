# Fase 1B — Fondasi Web: Rencana Implementasi

> Status: **selesai dan diaudit** (12 Nov 2026), lihat [audit Fase 1B](../audits/fase-1b.md). Deviasi pelaksanaan tercatat di §6 laporan audit.

**Tujuan:** Aplikasi `apps/web` (Next.js 16) berdiri dengan seluruh fondasi yang dibutuhkan halaman publik di Fase 1C: token desain v0.4, komponen atomik, brand (logo, ikon, ilustrasi, maskot Kapa beranimasi), kerangka responsif (desktop dan mobile), empat status sistem publik, klien API server-only dengan validasi ganda, revalidasi cache berbasis tag, keamanan header (CSP hibrida), serta kontainer `web` di belakang Traefik.

**Arsitektur:** Halaman publik dirender di server (React Server Components) dan disajikan **statis + ISR**. HTML dibuat sekali per pembaruan data, bukan per pengunjung. Data diambil dari `api` lewat klien server-only bertoken. Respons divalidasi ulang dengan skema `@kawan-pasar/contracts` dan disimpan di cache data Next.js bertag. Saat data berubah, `api` memanggil endpoint revalidasi internal di `web`. Komponen klien hanya untuk interaksi dan animasi.

**Tech stack:**

- Next.js 16.4.6, React / React DOM 19.3.1, Tailwind CSS 4.3.5 (`@tailwindcss/postcss`).
- Vitest 5 + Testing Library + happy-dom, Playwright 1.65 + axe 4.14.
- Tanpa library UI, ikon, grafik, atau animasi.

**Spec:** `docs/design/2026-11-11-kawan-pasar-design.md` §2, §3, §6.2, §9, §10, §11. Acuan visual: `figcraft-Kawan_Pasar/` (`lib.mjs` token, `assets.mjs` brand, `p3_components.mjs` komponen, `p4_foundations.mjs` panduan gerak, `shots/`).

**Keputusan pemilik (12 Nov 2026):** **CSP hibrida.**

- Halaman publik statis + ISR dengan CSP ketat tanpa nonce: skrip hanya dari `'self'` + SRI, tanpa origin eksternal.
- Nonce penuh dipakai di halaman akun (Fase 2), yang memang dinamis.

## Batasan global

- Semua batasan Fase 0/1A tetap berlaku:
  - Tanpa atribusi AI; git dijalankan pemilik.
  - TS strict tanpa `any` dan `@ts-*`.
  - Versi dipin.
  - Tidak diketahui = `null`, ditampilkan "—", tidak pernah 0.
- **Anggaran:** JS awal ≤ 170 KB terkompresi per rute; CLS < 0,1; tanpa gambar raster; tanpa origin pihak ketiga (font di-self-host).
- **Aksesibilitas:**
  - WCAG 2.2 AA; informasi tidak bergantung pada warna (arah perubahan selalu punya panah + tanda).
  - Target sentuh ≥ 44 px; fokus terlihat; `lang="id"`; tautan lewati-ke-konten.
- **Responsif:**
  - Mobile-first; tanpa scroll horizontal dari 360 px.
  - Breakpoint: `< 640` mobile (TopBar + TabBar bawah), `640–1023` tablet, `≥ 1024` desktop (NavBar atas).
  - Konten maksimal 1280 px dengan margin 80 di desktop dan 16 di mobile.
- **Pembagian komponen:**
  - Atom dan molekul tidak mengambil data; data diambil di tingkat halaman.
  - `'use client'` hanya untuk interaksi (status aktif navigasi, animasi Kapa, tombol coba lagi).
- **Format:** Rupiah `Rp 52.400` (id-ID), persen `+2,8%` dari pecahan API, tanggal WIB (`Asia/Jakarta`), angka harga memakai Geist Mono dengan `tabular-nums`.
- **Gerak (v0.4):**
  - Kapa melayang 5 px dengan gestur lengan/daun (900 ms ease-in-out) dan kedip 140 ms dalam siklus ±3,2 detik.
  - Kartu: fade + naik 12–16 px (400 ms ease-out, jeda 80 ms per item).
  - Bubble: fade + naik 8 px (500 ms, tunda 300 ms).
  - Hanya `transform`/`opacity`; mati di `prefers-reduced-motion: reduce`; animasi dijeda bila di luar viewport.
- **Kapa:** satu per layar, 84–200 px, dekoratif (`aria-hidden`) kecuali menyampaikan status, yang selalu disertai teks.
- Bahasa UI tidak kausal dan tidak berisi rekomendasi beli/jual. Halaman prediksi wajib memuat "prediksi bukan jaminan harga" (komponen disiapkan di sini).

## Fokus tinjauan

1. **`next build` tanpa API.** Image `web` dibangun di Docker tanpa akses ke `api`. Build harus lulus, dan halaman data tidak boleh menyimpan status galat build ke cache ISR. Uji: build dengan `API_INTERNAL_URL` tak terjangkau → lulus. Setelah start, permintaan pertama merender data nyata dan permintaan berikutnya `x-nextjs-cache: HIT` (Task 4).
2. **Rate limit API untuk render server.** Fetch saat render/revalidasi datang dari IP `web` tanpa `X-Forwarded-For`, sehingga semuanya berbagi satu ember 120/menit. Lonjakan revalidasi tidak boleh berbuah 429 → halaman galat (Task 4).
3. **Endpoint revalidasi terekspos publik.** `POST /api/internal/*` dari internet → bukan 2xx (diblokir Traefik). Dari jaringan internal tanpa atau dengan token salah → 401 tanpa membedakan alasannya (Task 5, 8).
4. **API lambat atau mati saat revalidasi.** Timeout 3 detik. Halaman tetap menyajikan versi cache terakhir. Bila belum ada cache, tampil status "Gagal memuat" dengan tombol coba lagi, bukan layar kosong atau stack trace (Task 4, 7).
5. **Layar 360 px, nama komoditas panjang, dan zoom teks 200%.** Tidak ada scroll horizontal, harga tidak terpotong, dan TabBar tidak menutupi konten (`safe-area-inset-bottom`) (Task 7, 9).

---

### Task 1: Paket `@kawan-pasar/tokens` dan bersih-bersih

**Files:**

- Create:
  - Konfigurasi: `packages/tokens/{package.json,tsconfig.json,tsconfig.build.json,eslint.config.js,vitest.config.ts}`.
  - Sumber: `packages/tokens/src/{index.ts,colors.ts,typography.ts,space.ts,motion.ts,contrast.ts}`.
  - `packages/tokens/scripts/build-css.ts` → `packages/tokens/dist/theme.css`.
- Test: `packages/tokens/src/tokens.test.ts`
- Hapus: `apps/api/undefined/` (cache `tsx` yang tertinggal dari run dengan `TEMP` kosong; tidak di-commit)

**Interfaces (Produces):**

- `colors`: 17 warna `Brand v0.4` persis dari `lib.mjs` (`canvas #FAF7F0` … `shallot-500 #B8325E`).
- `typeScale`: 16 gaya (`display-56` … `numeric-s-14`): `{family:'sans'|'mono', weight, sizePx, lineHeight, letterSpacingEm}`.
- `space` (4–80, grid 8), `radius` (`sm 8, md 14, lg 20, xl 24, 2xl 32, full 9999`), `breakpoints` (`sm 640, lg 1024`), `contentMaxPx 1280`.
- `motion`: `{kapaBobMs:900, kapaBlinkMs:140, kapaCycleMs:3200, cardMs:400, cardStaggerMs:80, bubbleMs:500, bubbleDelayMs:300}`.
- `contrastRatio(fg, bg): number` (WCAG 2.x).
- `theme.css`: blok Tailwind 4 `@theme { --color-*, --font-*, --text-*, --radius-*, --breakpoint-* }`, dibangkitkan dari sumber TS (satu sumber kebenaran).

- [ ] **Step 1:** Tulis `tokens.test.ts`:
  - `colors.ink === '#14201A'`.
  - Pasangan teks yang dipakai UI lolos AA (≥ 4,5:1 untuk teks biasa, ≥ 3:1 untuk teks besar dan ikon), mis. `ink`/`canvas`, `ink-2`/`surface`, `green-900`/`green-100`, `chili-600`/`chili-100`, `terong-600`/`terong-100`, `surface`/`green-900`.
  - Pasangan yang gagal ditandai dan **dilarang dipakai untuk teks** (daftar `TEXT_PAIRS_FORBIDDEN` diuji): `muted`/`canvas` hanya untuk teks ≥ 18,66 px tebal.
  - `theme.css` hasil build memuat `--color-green-900: #0E4D35`.
- [ ] **Step 2:** `pnpm --filter @kawan-pasar/tokens test` → GAGAL.
- [ ] **Step 3:** Implementasi. Bila ada warna v0.4 yang gagal AA pada pemakaian teks aslinya (kandidat: `muted #7C877F`, `chili-600` di atas putih untuk teks kecil), **jangan ubah token**. Tambahkan varian teks yang lebih gelap (mis. `chili-700`) dan catat sebagai Ruling di audit.
- [ ] **Step 4:** Uji LULUS; `build` menghasilkan `dist/theme.css`.
- [ ] **Step 5 — Checkpoint (pemilik):** `feat(tokens): token desain v0.4 dan tema tailwind`

### Task 2: Kerangka `apps/web` — Next.js, Tailwind, font, env, header keamanan

**Files:**

- Create:
  - Konfigurasi: `apps/web/{package.json,next.config.ts,postcss.config.mjs,tsconfig.json,eslint.config.js,vitest.config.ts,vitest.setup.ts}`.
  - App: `apps/web/src/app/{layout.tsx,globals.css,page.tsx,not-found.tsx,error.tsx,global-error.tsx}`.
  - Lib: `apps/web/src/lib/{env.ts,csp.ts}`.
- Create: `apps/web/src/brand/fonts/{PlusJakartaSans-latin.woff2,GeistMono-latin.woff2,OFL-PlusJakartaSans.txt,OFL-GeistMono.txt}` (subset latin + latin-ext dibuat dengan `pyftsubset` via `uvx fonttools` dari berkas di `figcraft-Kawan_Pasar/fonts/`; langkahnya dicatat di `docs/design-system/token.md`)
- Modify: `packages/eslint-config/index.js` (ekspor tambahan `react` dengan `@next/eslint-plugin-next` + `eslint-plugin-react-hooks`, `no-explicit-any` tetap), `turbo.json` (`build` web menghasilkan `.next/**` kecuali `.next/cache/**`), `scripts/gen-env.mjs` + `.env.example` (`WEB_REVALIDATE_TOKEN`)
- Test: `apps/web/src/lib/{env.test.ts,csp.test.ts}`

**Interfaces (Produces):**

- `serverEnv()` (`server-only`), divalidasi Zod sekali lalu dibekukan:
  - `API_INTERNAL_URL` (URL http/https).
  - `SERVICE_TOKEN` (≥ 32 karakter).
  - `WEB_REVALIDATE_TOKEN` (≥ 32 karakter, harus berbeda dari `SERVICE_TOKEN`).
  - `API_TIMEOUT_MS` (default 3000, 500–10000).
  - Galat menyebut nama variabel, tidak pernah nilainya.
- `buildCsp({dev}): string`:
  - `default-src 'self'; script-src 'self'` (+ `'unsafe-eval'` hanya saat dev); `style-src 'self' 'unsafe-inline'`.
  - `img-src 'self' data:; font-src 'self'; connect-src 'self'`.
  - `object-src 'none'; base-uri 'none'; form-action 'self'; frame-ancestors 'none'`.
- `next.config.ts`:
  - `output:'standalone'`, `poweredByHeader:false`, `reactStrictMode:true`, `typedRoutes:true`.
  - `experimental.sri.algorithm:'sha256'`.
  - `headers()` memasang CSP + `Cross-Origin-Opener-Policy`.
  - Tanpa `images` remote. `transpilePackages` untuk paket workspace.
- `layout.tsx`:
  - `next/font/local` (`--font-sans`, `--font-mono`, `display:'swap'`).
  - `<html lang="id">`, metadata dasar (judul "Kawan Pasar", `themeColor #0E4D35`), dan tautan lewati-ke-konten.

- [ ] **Step 1:** Tulis uji:
  - `env.test.ts`: menolak token pendek, menolak token revalidasi yang sama dengan token layanan, dan pesan galat tidak memuat nilai.
  - `csp.test.ts`:
    - Produksi tidak memuat `unsafe-eval`.
    - Memuat `frame-ancestors 'none'` dan `object-src 'none'`.
    - Tidak memuat `http:`, `https:`, atau `*`.
- [ ] **Step 2:** `pnpm --filter @kawan-pasar/web test` → GAGAL.
- [ ] **Step 3:** Implementasi. Pasang dependensi dengan versi tepat (cek `minimumReleaseAge` lewat `pnpm install`): `next 16.4.6`, `react`/`react-dom 19.3.1`, `tailwindcss`/`@tailwindcss/postcss 4.3.5`, `server-only`, `zod` (versi workspace), dan `@types/react*`. Dev: `@testing-library/react`, `happy-dom`, `@vitejs/plugin-react`, `@next/eslint-plugin-next 16.4.6`, `eslint-plugin-react-hooks`.
- [ ] **Step 4:** Uji LULUS; `pnpm --filter @kawan-pasar/web build` lulus.
- [ ] **Step 5 — Spike CSP + SRI (wajib, ±30 menit):** `next start`, buka `/` di Chromium (Playwright), dan baca konsol.
  - **Lolos:** tanpa pelanggaran CSP dan tanpa galat hidrasi dengan `script-src 'self'` + SRI.
  - **Bila skrip inline RSC Next diblokir:** pakai cadangan yang sudah disetujui pemilik untuk opsi hibrida, yaitu menambah `'unsafe-inline'` **hanya** pada `script-src`. Direktif lain tetap ketat. Catat sebagai Ruling di ADR 0008.
- [ ] **Step 6 — Checkpoint (pemilik):** `feat(web): kerangka next.js, font self-host, env tervalidasi, dan csp`

### Task 3: Format dan utilitas tampilan

**Files:**

- Create: `apps/web/src/lib/format.ts`
- Test: `apps/web/src/lib/format.test.ts`

**Interfaces (Produces):**

- `formatRupiah(n: number | null): string`: `52400` → `Rp 52.400`, `null` → `—`.
- `formatChange(fraction: number | null, digits = 1): string`: `0.028` → `+2,8%`, `-0.011` → `−1,1%` (tanda minus U+2212), `0` → `0,0%`, `null` → `—`.
- `changeDirection(fraction: number | null): 'up' | 'down' | 'flat' | null`. Ambang datar: |x| < 0,0005, setara 0,0% setelah dibulatkan.
- `formatDateWib(iso: string, style: 'short' | 'long'): string`: `2026-11-03` → `Sel, 3 Nov 2026` / `Selasa, 3 November 2026`. Tanggal tanpa jam diperlakukan sebagai tanggal kalender WIB, tidak digeser zona.
- `formatHorizon(days: Horizon): string`: `1` → `1H`, `30` → `30H`, `365` → `1T` (label pil v0.4), dan versi panjang `"7 hari"`, `"1 tahun"`.
- Semua `Intl.*Format` dibuat sekali di tingkat modul.

- [ ] **Step 1:** Uji untuk setiap fungsi, termasuk:
  - `null`, `0`, negatif, dan pembulatan `0.02849` → `+2,8%`.
  - Pemisah ribuan `1234567` → `Rp 1.234.567`.
  - Tanggal 31 Des tidak bergeser zona.
- [ ] **Step 2:** GAGAL → **Step 3:** implementasi → **Step 4:** LULUS.
- [ ] **Step 5:** (digabung ke commit Task 4)

### Task 4: Klien API server-only, cache bertag, dan ember rate limit internal

**Files:**

- Create: `apps/web/src/lib/api/{client.ts,endpoints.ts,tags.ts,errors.ts}`
- Modify:
  - API: `apps/api/src/common/rate-limit.guard.ts`, `apps/api/src/common/client-ip.ts`, `apps/api/src/config/env.ts` (`RATE_LIMIT_INTERNAL_PER_MINUTE`, default 1200).
  - Dokumen: `docs/api/v1.md`, `docs/architecture/adr/0005-rate-limit-dan-proxy-tepercaya.md` (tambahan).
- Test: `apps/web/src/lib/api/client.test.ts`, `apps/api/test/common/rate-limit.int.test.ts` (tambahan)

**Interfaces (Produces):**

- `apiGet<S extends z.ZodType>(path, schema: S, opts: {tags: string[], revalidate: number}): Promise<ApiResult<z.infer<S>>>`, dengan `ApiResult<T> = {ok: true, data: T} | {ok: false, kind: 'not_found' | 'unavailable'}`.
  - Header `x-service-token`; `AbortSignal.timeout(API_TIMEOUT_MS)`; `cache: 'force-cache'`, `next: {tags, revalidate}`.
  - **Respons divalidasi ulang dengan skema contracts.** Bila tidak cocok, hasilnya `unavailable` + log (tanpa isi respons).
  - Kode 404 → `not_found`. Galat 5xx/timeout/jaringan → `unavailable`, tanpa retry di jalur render. Fetch Next yang gagal tidak disimpan ke cache, sehingga permintaan berikutnya mencoba lagi.
- `endpoints.ts` (sumber path tunggal): `getMarkets()`, `getPriceSummary(market)`, `getHistory(market, commodity, range)`, `getForecast(market, commodity)`, `getArticles(category?)`, `getArticle(slug)`.
  - `revalidate` cadangan: harga/prediksi 600 detik, artikel 21600 detik, pasar 86400 detik.
- `tags.ts`:
  - `tagsFor = {markets:'markets', prices:(m)=>'prices:'+m, history:(m,c)=>'history:'+m+':'+c, forecast:(m)=>'forecast:'+m, articles:'articles', article:(s)=>'article:'+s}`.
  - `parseTag(s): Tag | null` (whitelist pola, maksimal 256 karakter).
- **API:** permintaan dari proxy tepercaya **tanpa** `X-Forwarded-For` (render/revalidasi server) memakai ember terpisah `internal` dengan batas `RATE_LIMIT_INTERNAL_PER_MINUTE`. Permintaan yang membawa `X-Forwarded-For` tetap per IP klien (120/menit). Permintaan dari IP bukan proxy tepercaya tidak pernah masuk ember `internal`.
- **Build tanpa API:** halaman data tidak diprerender saat build. Prerender ditunda ke permintaan pertama, lalu di-cache (ISR on-demand). Cara yang dipilih (mis. `generateStaticParams` kosong + `dynamicParams`, atau penanda fase build di `apiGet` yang membuat halaman dinamis hanya saat build) diputuskan di langkah 3, dibuktikan dengan uji Fokus tinjauan #1, dan dicatat di ADR 0009.

- [ ] **Step 1:** Tulis uji:
  - `client.test.ts` (fetch tiruan):
    - Mengirim token dan tag.
    - Respons tidak cocok skema → `unavailable`.
    - 404 → `not_found`; timeout → `unavailable`.
    - Log tidak memuat token maupun isi respons.
  - `parseTag` menolak `prices:PIKJ;drop`, menolak tag 300 karakter, dan menerima `history:PIKJ:bawang-merah`.
  - `rate-limit.int.test.ts`:
    - 150 permintaan dari proxy tepercaya tanpa XFF → semuanya 200.
    - 150 permintaan dengan satu XFF → 120 × 200, sisanya 429.
    - Klien luar yang memalsukan asal tidak masuk ember `internal`.
- [ ] **Step 2:** GAGAL → **Step 3:** implementasi → **Step 4:** LULUS (web unit + API integrasi).
- [ ] **Step 5 — Checkpoint (pemilik):** `feat(web): klien api server-only dengan validasi ganda, cache bertag, dan ember rate limit internal`

### Task 5: Revalidasi bertag dari API ke web

**Files:**

- Create: `apps/web/src/app/api/internal/revalidate/route.ts`, `apps/web/src/app/api/health/route.ts`, `apps/web/src/lib/revalidate-auth.ts`
- Create: `apps/api/src/modules/internal/web-revalidator.ts`
- Modify: `apps/api/src/modules/internal/*` (setelah invalidasi Valkey), `apps/api/src/bundles/cli.ts` (setelah promosi), `apps/api/src/config/env.ts` (`WEB_INTERNAL_URL` opsional, `WEB_REVALIDATE_TOKEN`), `services/ingest` tidak berubah (ingest → api → web)
- Test: `apps/web/src/app/api/internal/revalidate/route.test.ts`, `apps/api/test/internal/web-revalidator.test.ts`

**Interfaces (Produces):**

- `POST /api/internal/revalidate`:
  - Body `{tags: string[]}` (1–50 tag, masing-masing lolos `parseTag`, `z.strictObject`), maksimal 8 KiB.
  - Header `x-revalidate-token` dibandingkan constant-time (hash SHA-256 + `timingSafeEqual`).
  - Hasil: 204 bila sukses; 401 bila token salah atau tidak ada; 400 bila body tidak valid (tanpa memantulkan input).
  - Setiap tag menjalankan `revalidateTag(tag, 'max')`: pengunjung berikutnya mendapat versi lama sekali sementara versi baru dibangun di latar, jadi tidak ada lonjakan render.
- `GET /api/health` → `{status:'ok'}` (tanpa memanggil API, untuk healthcheck kontainer).
- `WebRevalidator.revalidate(tags: string[]): Promise<void>` di API:
  - Best effort, timeout 3 detik. Kegagalan hanya dicatat dengan `ThrottledWarning`; TTL ISR membatasi umur data yang basi.
  - Pemetaan invalidasi:
    - Harga → `prices:<m>` + `history:<m>:<c>` untuk semua komoditas dari katalog + `forecast:<m>`.
    - Promosi bundel → `forecast:<m>` + `prices:<m>`.
    - Seed artikel → `articles` + `article:<slug>`.

- [ ] **Step 1:** Tulis uji:
  - Route: token salah → 401; token kosong → 401 dengan respons identik; tag ilegal → 400; tag sah → 204 dan `revalidateTag` dipanggil dengan `'max'` (dimock lewat `vi.mock('next/cache')`).
  - API: invalidasi harga memanggil web dengan daftar tag yang tepat; web mati → invalidasi Valkey tetap sukses dan muncul satu peringatan.
- [ ] **Step 2:** GAGAL → **Step 3:** implementasi → **Step 4:** LULUS.
- [ ] **Step 5 — Checkpoint (pemilik):** `feat(web): revalidasi cache bertag yang dipicu api`

### Task 6: Brand — logo, ikon, ilustrasi, dan maskot Kapa beranimasi

**Files:**

- Create:
  - Komponen: `apps/web/src/brand/{Logo.tsx,CommodityIcon.tsx,FeatureIcon.tsx,Illustration.tsx,Kapa.tsx,KapaMotion.tsx}`.
  - Data: `apps/web/src/brand/{kapa-poses.ts,icons-data.ts,illustrations-data.ts}`.
  - Gaya: `apps/web/src/brand/kapa.css`.
- Test: `apps/web/src/brand/{kapa.test.tsx,icons.test.tsx}`

**Interfaces (Produces):**

- `<Logo variant="horizontal" | "mark" tone="default" | "inverse" size?>`: SVG inline dari `LOGO_MARK`/`LOGO_MARK_INV`. Wordmark "kawan pasar" ditulis dengan teks (Plus Jakarta Sans ExtraBold), bukan path, dengan `aria-label="Kawan Pasar"`.
- `<CommodityIcon code={CommodityCode} size?>` (5 ikon, dipetakan dari kode katalog, bukan nama tampilan); `<FeatureIcon name={FeatureIconName} size?>` (19 ikon duotone); `<Illustration name="lapak" | "inflasi" | "arif-net" | "peta">`.
- `<Kapa pose={KapaPose} size={84..200} animated? label?>`:
  - **Server Component.** Geometri pose persis dari `kapaSVG(pose, 1)`.
  - Grup `Rig`, `Daun`, `ArmL`, `ArmR`, `Mata`, `Prop` diberi kelas animasi.
  - Tanpa `label` → `aria-hidden="true"`; dengan `label` → `role="img"` + `<title>`.
- `KapaMotion` (`'use client'`, ±1 KB): membungkus Kapa, menambah atribut `data-playing` saat terlihat (IntersectionObserver), dan tidak melakukan apa pun saat `prefers-reduced-motion`.
- `kapa.css`:
  - Keyframes `kapa-bob` (`translateY(0 → -5px)`, 900 ms ease-in-out, bolak-balik).
  - `kapa-leaf` (rotate −5° di poros 80,34) dan `kapa-arm` (gestur, rotasi kecil di bahu, meniru frame 2).
  - `kapa-blink` (`scaleY(1 → 0.1)` selama 140 ms di akhir siklus 3,2 detik).
  - Animasi hanya berjalan bila `[data-playing]` ada.
  - Di dalam `@media (prefers-reduced-motion: reduce)`, semua animasi `none`.

- [ ] **Step 1:** Tulis uji:
  - Ketujuh pose dirender dan masing-masing punya `Prop` yang sesuai (`chart` untuk Prediksi, `zzz` untuk Istirahat, `alert` untuk Waspada).
  - Tanpa label → `aria-hidden`; dengan label → nama aksesibel sama dengan label.
  - Logo punya nama aksesibel "Kawan Pasar".
  - Setiap `CommodityCode` di katalog punya ikon (uji kelengkapan), demikian juga setiap `FeatureIconName`.
  - `kapa.css` memuat blok `prefers-reduced-motion` yang mematikan animasi (uji membaca berkas CSS).
- [ ] **Step 2:** GAGAL → **Step 3:** port SVG dari `assets.mjs` ke data bertipe (warna lewat token, bukan hex tersebar) → **Step 4:** LULUS.
- [ ] **Step 5 — Checkpoint (pemilik):** `feat(web): brand v0.4 — logo, ikon, ilustrasi, dan maskot kapa beranimasi`

### Task 7: Komponen atomik — atom, molekul, organisme, template, dan status sistem

**Files (atomic design, satu komponen per berkas, ekspor bernama):**

- `src/components/atoms/`:
  - `Button` (5 varian × 3 ukuran; `href` → `<Link>`, selain itu `<button>`).
  - `Chip` (8 tone × 2 ukuran).
  - `Delta` (panah ↑/↓ + tanda + `formatChange`; `null` → "—"; teks tersembunyi "naik/turun/stabil").
  - `PredictionBadge` (status `available` → ★ + perubahan; `expired` → "Kedaluwarsa"; `pending_coverage` → "Prediksi menyusul"; `hidden`/`unavailable` → "Belum tersedia"; `isDemo` → chip "Data demo").
  - `Sparkline` (SVG server; < 2 titik → garis putus-putus netral + teks "Data belum cukup"; warna mengikuti arah dan tidak menjadi satu-satunya penanda).
  - `IconBox`, `HorizonPill`, `NavItem`, `TabItem`, `Price` (Geist Mono tabular), `Disclaimer` ("Prediksi adalah estimasi, bukan jaminan harga.").
- `src/components/molecules/`:
  - `CommodityCard`, `CommodityRow` (mobile), `StatCard`, `MetricCard`.
  - `SectionHeader`, `KataKapa`, `CoverageStrip`, `SelectField` (native `<select>`), `MarketPicker` (tautan ke `/pasar`).
  - `StatePanel` (pose Kapa + chip + judul + isi + aksi).
- `src/components/organisms/`:
  - `NavBar` (desktop), `TopBar` (mobile), `TabBar` (mobile, `position: fixed`, `padding-bottom: env(safe-area-inset-bottom)`), `Footer`.
  - `NavLinks` (`'use client'`, hanya `usePathname` untuk `aria-current`).
  - `SystemState`: 4 status publik:
    - `forecast_pending`: Istirahat, "Prediksi menyusul".
    - `market_unavailable`: Istirahat, "Pasar belum tersedia".
    - `price_stale`: Waspada, "Harga terlambat" + tanggal data terakhir.
    - `load_failed`: Waspada, "Gagal memuat" + `RetryButton` (`'use client'`, `router.refresh()` atau `reset()` dari error boundary).
- `src/components/templates/`:
  - `SiteShell`: NavBar ≥ 1024, TopBar + TabBar < 1024, Footer.
  - `<main id="konten">`, ruang bawah sebesar TabBar di mobile, dan `PageContainer` (maks. 1280, margin 16/24/80).
- Modify: `src/app/layout.tsx` (pakai `SiteShell`), `src/app/page.tsx` (halaman sementara: hero ringkas + `StatePanel` "Halaman sedang disiapkan"; diganti di 1C), `error.tsx` dan `not-found.tsx` memakai `SystemState`.
- Test: `src/components/**/*.test.tsx`

**Interfaces (Produces):** props bertipe dari `@kawan-pasar/contracts` (mis. `CommodityCard` menerima `CommoditySummary` + `marketCode`). Tidak ada fetch dan tidak ada `useEffect` di atom/molekul.

- [ ] **Step 1:** Tulis uji (Testing Library):
  - `Delta` dengan `0.032` → teks "↑ +3,2%" dan nama aksesibel memuat "naik"; `null` → "—".
  - `CommodityCard` dengan `latest:null, dataStatus:'no_data'` → "—" dan "Data belum tersedia", tanpa "Rp 0".
  - `CommodityCard` `stale` → chip "Terlambat".
  - `PredictionBadge`: `expired` → "Kedaluwarsa"; `isDemo` → "Data demo".
  - `Button` dengan `href` merender `<a>`; ukuran S tetap punya tinggi target ≥ 44 px (kelas `min-h-11`).
  - `NavLinks` menandai rute aktif dengan `aria-current="page"`.
  - `SystemState load_failed` punya tombol "Coba lagi".
  - `SiteShell` merender `main#konten` dan tautan lewati-ke-konten.
- [ ] **Step 2:** GAGAL → **Step 3:** implementasi (Tailwind memakai token dari `@kawan-pasar/tokens/theme.css`, tanpa nilai warna lepas) → **Step 4:** LULUS.
- [ ] **Step 5 — Checkpoint (pemilik):** `feat(web): komponen atomik v0.4, kerangka responsif, dan status sistem`

### Task 8: Kontainer `web` dan rute Traefik

**Files:**

- Create: `apps/web/Dockerfile` (multi-stage: build dengan `pnpm deploy`/standalone, runtime `node:24-alpine`, user `node`, `HEALTHCHECK` ke `/api/health`), `.dockerignore` (tambahan)
- Modify:
  - `infra/compose/docker-compose.yml`:
    - Layanan `web`: `ipv4_address 172.30.0.10`, `read_only` + `tmpfs` untuk `/app/apps/web/.next/cache`.
    - Env `API_INTERNAL_URL=http://api:3001`, `SERVICE_TOKEN`, `WEB_REVALIDATE_TOKEN`.
    - `depends_on api healthy`.
    - Pada `api`: `WEB_INTERNAL_URL=http://web:3000` dan `WEB_REVALIDATE_TOKEN`.
  - `infra/traefik/dynamic/routes.yml`:
    - Router `web` (`PathPrefix('/')`) → `http://web:3000` dengan health check.
    - Router `block-internal` (`PathPrefix('/api/internal')`, prioritas tertinggi) → `noop@internal`.
    - Router `fallback` dihapus.
  - `scripts/infra-check.mjs` (pemeriksaan baru di bawah), `docs/operations/menjalankan-lokal.md`.
- Test: `scripts/infra-check.mjs` (pemeriksaan baru)

**Pemeriksaan infra baru:**

- `GET http://127.0.0.1:8080/` → 200 dengan `content-security-policy` memuat `frame-ancestors 'none'`.
- Tanpa `x-powered-by`.
- `content-encoding: br` untuk aset JS.
- `POST /api/internal/revalidate` dari host → bukan 2xx.
- `web` → `api` dengan token sah → 200 (lewat `docker compose exec`).
- Kontainer `web` berjalan sebagai non-root dengan filesystem read-only.

- [ ] **Step 1:** Tambahkan pemeriksaan ke `infra-check` → jalankan → GAGAL (web belum ada).
- [ ] **Step 2:** Implementasi → `pnpm infra:up` → `pnpm infra:check` LULUS (17 pemeriksaan lama + yang baru).
- [ ] **Step 3:** Uji Fokus tinjauan #1 secara langsung:
  - Build image tanpa API (sudah otomatis di Docker) → lulus.
  - Permintaan pertama `/` → 200.
  - Permintaan kedua → `x-nextjs-cache: HIT`.
  - `POST` revalidasi dari kontainer `api` → 204.
  - Permintaan berikutnya mendapat versi baru.
- [ ] **Step 4 — Checkpoint (pemilik):** `feat(infra): kontainer web di belakang traefik dan blokir rute internal`

### Task 9: Uji asap e2e, dokumentasi, dan audit Fase 1B

**Files:**

- Create: `tests/e2e/{package.json,playwright.config.ts,tsconfig.json,eslint.config.js}`, `tests/e2e/specs/shell.spec.ts`
- Create: `docs/design-system/{README.md,token.md,komponen.md,maskot-dan-gerak.md,responsif.md}`, `docs/architecture/adr/0008-csp-hibrida.md`, `docs/architecture/adr/0009-isr-bertag-dan-revalidasi.md`, `docs/audits/fase-1b.md`
- Modify: `scripts/audit.mjs` (gerbang baru: build web, anggaran JS, e2e asap), `docs/testing/strategi-uji.md`, `CHANGELOG.md`, `docs/README.md`

**`shell.spec.ts`** dijalankan terhadap tumpukan Docker lewat Traefik, di Chromium, pada lebar 360, 390, 768, 1024, 1280, dan 1440:

- `document.documentElement.scrollWidth <= innerWidth` (tanpa scroll horizontal).
- < 1024: TabBar terlihat dan NavBar tersembunyi; ≥ 1024: sebaliknya.
- Elemen terakhir `main` tidak tertutup TabBar.
- Navigasi keyboard: Tab pertama memfokus "Lewati ke konten".
- Fokus terlihat (outline tidak `none`).
- Tidak ada pesan konsol CSP/galat.
- `axe` (tag `wcag2a`, `wcag2aa`, `wcag21aa`, `wcag22aa`) → 0 pelanggaran.
- Dengan `reducedMotion: 'reduce'` → `getComputedStyle(kapaRig).animationName === 'none'`.
- Total JS terkompresi yang dimuat `/` ≤ 170 KB (diukur dari `transferSize` resource dengan `initiatorType === 'script'`).
- Zoom teks 200% di 360 px → tanpa scroll horizontal.

- [ ] **Step 1:** Tulis spesifikasi → jalankan → GAGAL pada butir yang belum terpenuhi (bila semuanya langsung lulus, ubah salah satu kondisi untuk membuktikan uji bisa gagal, lalu kembalikan).
- [ ] **Step 2:** Perbaiki → LULUS.
- [ ] **Step 3:** `pnpm audit:all` → semua gerbang lulus (gerbang Fase 1A + build web + anggaran JS + e2e asap).
- [ ] **Step 4:** Tinjauan independen atas seluruh perubahan Fase 1B (model paling mampu), memakai Fokus tinjauan di atas. Temuan Kritis/Penting diperbaiki RED → GREEN; temuan minor ditunda dan dicatat.
- [ ] **Step 5:** Simulasi pengguna akhir dan pemeriksaan visual di browser sungguhan (360 dan 1280): shell, Kapa bergerak/diam sesuai preferensi, kontras, dan fokus. Hasil dicatat di `docs/audits/fase-1b.md`.
- [ ] **Step 6 — Checkpoint (pemilik):** `docs: sistem desain, adr csp dan isr, serta audit fase 1b`

## Di luar lingkup Fase 1B (masuk 1C/1D)

- Halaman data (Beranda, Harga, Detail, Prediksi, Edukasi, Artikel, ARIF-Net, Keterbatasan, Pasar, Lainnya), grafik harga/prediksi, render Markdown tersanitasi, dan pengalihan `kp_onboarded` → 1C.
- E2E alur lengkap, Lighthouse (LCP 4G), k6 lewat halaman web, dan validasi ulang p95 → 1D.
- Replika `web` > 1: cache ISR Next.js tersimpan per kontainer. Fan-out revalidasi ke beberapa replika, atau cache handler bersama di Valkey, diputuskan di 1D bersama uji beban (dicatat di ADR 0009).
