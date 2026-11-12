# Fase 1C — Halaman Publik: Rencana Implementasi

> Status: **selesai dan diaudit** (13 Nov 2026), lihat [audit Fase 1C](../audits/fase-1c.md). Deviasi pelaksanaan tercatat di §6 laporan audit.

**Tujuan:** Seluruh halaman publik v0.4 berjalan dengan data nyata, responsif dari 320 px sampai desktop:

- Beranda Publik (orientasi), Beranda, Harga, Detail komoditas, Prediksi.
- Edukasi, Artikel, ARIF-Net, Keterbatasan, Pilih Pasar, Lainnya.

Semuanya disajikan statis/ISR dari fondasi Fase 1B.

**Arsitektur:**

- Halaman data dirender di server, di bawah `app/[market]/…` (rewrites + `proxy.ts`, ADR 0009).
- Grafik berupa SVG yang dirender server. Interaksi (rentang grafik, horizon, filter, tooltip) memakai pulau klien kecil yang hanya mengganti atribut `data-*` atau membaca data yang sudah ada di halaman. **Tidak ada fetch dari browser.**
- Aturan produk dihitung di fungsi murni yang diuji, bukan di dalam JSX.

**Tech stack:** sama dengan Fase 1B, ditambah `react-markdown` 10.1.0 (keputusan pemilik), yang hanya dijalankan di server.

**Spec:** `docs/design/2026-11-11-kawan-pasar-design.md` §2, §3, §6.2, §10. Acuan layar: `figcraft-Kawan_Pasar/shots/{d_*,m_*}.png`, `p5`–`p11` (skrip layar). ADR 0006, 0008, 0009. Audit 1B §5 (minor tertunda #2 dan #4 diselesaikan di sini).

**Keputusan pemilik (12 Nov 2026):**

1. Markdown artikel dirender dengan `react-markdown` di server: HTML mentah diabaikan, elemen dibatasi daftar putih.
2. Edukasi hanya menampilkan artikel **terbit**. Topik lain tampil sebagai "Topik lain segera hadir" tanpa judul. Draf tidak pernah bocor.

## Batasan global

- Semua batasan Fase 0–1B tetap berlaku: tanpa atribusi AI, git oleh pemilik, TS strict, `null` → "—", anggaran JS ≤ 170 KB/rute, WCAG 2.2 AA, target sentuh ≥ 44 px, tanpa scroll horizontal dari 320 px, teks 200% tetap muat.
- **Prediksi selalu membawa metadata.** Setiap tampilan angka prediksi (kartu, tabel, grafik, badge) berada di halaman yang menampilkan versi model, versi data, batas data, dan label **"Data demo"** bila `isDemo`, ditambah `Disclaimer`.
  - `expired` → angka tetap tampil dengan label "Kedaluwarsa".
  - `hidden`/`unavailable`/`pending_coverage` → **tidak ada angka prediksi di mana pun**, termasuk grafik dan tabel.
- **Bahasa:** tidak kausal ("karena"), tanpa saran beli/jual. Teks "Kata Kapa" dibangkitkan dari aturan yang diuji dan hanya menyatakan fakta data. Contoh: "Cabai merah keriting naik 6,6% dalam 7 hari."
- **Waktu:** semua tanggal WIB. "Hari ini" = tanggal kalender Asia/Jakarta.
- **Tanpa interpolasi.** Celah tanggal di data tidak diisi; garis menghubungkan observasi yang ada.
- **Halaman tanpa JS:** setiap halaman tetap bisa dibaca. Tampilan bawaan pulau klien adalah 90 hari untuk grafik harga dan 7 hari untuk horizon, dan tautan tetap berfungsi.

## Fokus tinjauan

1. **Status prediksi di semua permukaan.** Pada `hidden`/`unavailable`/`pending_coverage`, tidak ada angka prediksi di kartu, tabel, metrik, grafik, Kata Kapa, maupun metadata halaman. `expired` selalu berlabel → Task 3, 5, 6, 7 (uji per komponen + e2e dengan bundel kedaluwarsa).
2. **Banjir path.** `/harga/<acak>`, `/prediksi/<acak>`, dan `/edukasi/<acak>` tidak boleh membuat render dan entri cache tak terbatas. Commodity dicek di `proxy.ts`. Slug artikel dicek terhadap daftar artikel yang sudah ter-cache sebelum memanggil API, dan slug tak dikenal → 404 `no-store` → Task 2, 8.
3. **Tanpa JavaScript.** Grafik, tabel horizon, dan filter tetap menampilkan isi yang benar, bukan kosong atau semua varian sekaligus → Task 4, 10 (e2e `javaScriptEnabled: false`).
4. **Data tepi untuk grafik.** Satu titik, harga datar (rentang 0), celah panjang, horizon 365 hari pada skala waktu, dan kuantil sebagian `null`: tanpa `NaN` di SVG, tanpa garis palsu → Task 4.
5. **Halaman basi saat API mati.** Halaman ISR yang dibuat saat data masih "segar" harus tetap memperingatkan bila hari ini sudah lewat 2 hari kerja dari observasi terakhir. Ini temuan audit 1B #4 → Task 1, 3 (`FreshnessNotice`).

---

### Task 1: API dan kontrak — metadata prediksi di ringkasan, keterlambatan sebagai aturan bersama

**Files:**

- Modify: `packages/contracts/src/prices.ts` (`PriceSummaryResponseSchema.forecastArtifact`), `apps/api/src/modules/prices/{prices.repository.ts,prices.service.ts}`, `docs/api/v1.md`
- Move: `apps/api/src/modules/prices/staleness.ts` → `packages/contracts/src/staleness.ts` (API mengimpornya dari paket bersama)
- Test: `apps/api/test/prices/*.int.test.ts` (tambahan), `packages/contracts/src/staleness.test.ts` (uji lama dipindah)

**Interfaces (Produces):**

- `PriceSummaryResponse.forecastArtifact: ForecastArtifact | null`: artefak aktif yang dipakai `forecast7d`, dengan bentuk sama seperti `/forecast`. Didapat dari query artefak aktif yang sudah ada (tanpa query tambahan; tetap ≤ 2 query saat cache kosong). Nilainya `null` bila tidak ada artefak aktif atau artefak `hidden`.
- Fungsi yang sudah ada dipindah apa adanya: `STALE_AFTER_BUSINESS_DAYS`, `wibDate(at: Date): string`, `businessDaysBetween(from, to): number`, `dataStatus(latestObservedOn | null, today): DataStatus`. Web memakai `dataStatus(...) === 'stale'`.

- [ ] **Step 1:** Uji:
  - Ringkasan membawa `forecastArtifact.isDemo === true` dan `modelVersion` saat bundel demo aktif.
  - `forecastArtifact === null` tanpa artefak aktif.
  - Jumlah query saat cache kosong tetap ≤ 2.
  - Uji keterlambatan lama lulus di lokasi baru.
- [ ] **Step 2:** GAGAL → **Step 3:** implementasi → **Step 4:** LULUS (unit + integrasi API).
- [ ] **Step 5 — Checkpoint (pemilik):** `feat(api): metadata artefak prediksi di ringkasan harga dan aturan keterlambatan bersama`

### Task 2: Rute, penjaga, orientasi, dan SEO

**Files:**

- Modify: `apps/web/next.config.ts` (rewrites), `apps/web/src/proxy.ts`
- Create: `apps/web/src/lib/routes.ts` (daftar rute data), `apps/web/src/app/{sitemap.ts,robots.ts}`, `apps/web/src/components/organisms/MarkOnboarded.tsx` (`'use client'`), `apps/web/src/lib/seo.ts`
- Delete: halaman sementara 1B yang digantikan (`app/{beranda,harga,prediksi,edukasi}/page.tsx`, `app/pasar` tetap lewat rewrite)
- Test: `apps/web/src/proxy.test.ts` (perluas), `apps/web/src/lib/routes.test.ts`

**Interfaces (Produces):**

- Rute publik → rute internal:

  | Publik                 | Internal                    |
  | ---------------------- | --------------------------- |
  | `/beranda`             | `/PIKJ/beranda`             |
  | `/harga`               | `/PIKJ/harga`               |
  | `/harga/:komoditas`    | `/PIKJ/harga/:komoditas`    |
  | `/prediksi`            | `/PIKJ/prediksi`            |
  | `/prediksi/:komoditas` | `/PIKJ/prediksi/:komoditas` |
  | `/edukasi`             | `/PIKJ/edukasi`             |
  | `/edukasi/:slug`       | `/PIKJ/edukasi/:slug`       |
  | `/pasar`               | `/PIKJ/pasar`               |

  `/prediksi` menampilkan komoditas pertama yang `covered`.

- `proxy.ts`:
  - `matcher` mencakup `/:market/(beranda|harga|prediksi|edukasi|pasar)…` dan `'/'`.
  - Segmen pasar tak dikenal → 404. Segmen komoditas tak dikenal (bukan `CommodityCode`) → 404. Slug yang tidak lolos `ArticleSlugSchema` → 404.
  - Semua 404 ini **di-rewrite ke halaman not-found statis**, bukan body kosong (minor 1B #2).
  - `/` dengan cookie `kp_onboarded=1` → 307 ke `/beranda`.
  - Uji memastikan setiap rewrite tercakup `matcher`. `matcher` harus literal (dibaca statis oleh Next), jadi uji ini yang menjaga keduanya tetap sinkron.
- `MarkOnboarded`: memasang `kp_onboarded=1; Max-Age=31536000; Path=/; SameSite=Lax` (+ `Secure` di https) saat pengunjung membuka halaman selain `/`. Cookie ini tidak mengidentifikasi pengguna dan hanya dipakai untuk pengalihan; dicatat di `docs/security`.
- `seo.ts`: `pageMetadata({title, description, path})` dengan `alternates.canonical` = path publik (bukan `/PIKJ/…`) dan `metadataBase` dari `PUBLIC_SITE_URL` (default `http://127.0.0.1:8080`).
- `sitemap.ts`: rute statis + detail/prediksi per komoditas dari katalog. Tidak memanggil API, jadi aman saat build. `robots.ts` menolak `/api/`.

- [ ] **Step 1:** Uji proxy:
  - `/PIKJ/harga/kopi` → 404.
  - `/PIKJ/harga/bawang-merah` → lanjut.
  - `/PIKJ/edukasi/..%2F` → 404.
  - `/` + cookie → 307 `/beranda`; `/` tanpa cookie → lanjut.
  - Setiap sumber rewrite cocok dengan salah satu `matcher` (dicek dengan `path-to-regexp` milik Next).
- [ ] **Step 2:** GAGAL → **Step 3:** implementasi → **Step 4:** LULUS.
- [ ] **Step 5:** (digabung ke commit Task 5)

### Task 3: Logika tampilan (fungsi murni)

**Files:**

- Create: `apps/web/src/lib/insights/{highlights.ts,kata-kapa.ts,changes.ts,forecast-view.ts,freshness.ts}`
- Create: `apps/web/src/components/organisms/FreshnessNotice.tsx` (`'use client'`)
- Test: `apps/web/src/lib/insights/*.test.ts`, `components/organisms/FreshnessNotice.test.tsx`

**Interfaces (Produces):**

- `weeklyHighlights(items: CommoditySummary[]): { topRise: Item | null; topFall: Item | null; forecast: { up: number; down: number; flat: number } | null }`
  - Hanya komoditas dengan `change7d` diketahui.
  - `topRise` hanya bila > +0,05%; `topFall` hanya bila < −0,05%. Selain itu `null`, dan kartu menampilkan "Tidak ada yang turun minggu ini".
  - `forecast` hanya menghitung status `available`/`expired`.
- `kataKapa(input): { pose: KapaPose; title: string; body: string } | null`. Aturan berurutan, dan setiap teks hanya menyatakan fakta data:
  - (a) harga terlambat → pose waspada + tanggal data;
  - (b) |Δ30 hari| ≥ 5% → "naik/turun X% dalam sebulan";
  - (c) prediksi `available` dengan median ≠ datar → "Perkiraan 7 hari: …" + "estimasi, bukan jaminan";
  - (d) selain itu → tips membaca harga (teks tetap).

  Uji menolak kata "karena", "beli", "jual", "pasti".

- `changesFromHistory(points: PricePoint[], latest: PricePoint, days: 1 | 7 | 30 | 90): number | null`: dibanding observasi terakhir pada atau sebelum `latest − days` hari kalender. `null` bila tidak ada observasi pembanding. Tanpa interpolasi.
- `forecastView(f: ForecastResponse)`:
  - Mengembalikan baris tabel 8 horizon (label, tanggal target WIB, perubahan, harga, status evaluasi → "Tersedia/Sebagian/Belum diuji").
  - `showNumbers` = status ∈ {available, expired}.
  - `label` "Kedaluwarsa"/"Data demo".
  - Kuantil `null` → "—".
- `isPageStale(latestObservedOn, now)`: memakai `dataStatus` + `wibDate` dari contracts. `FreshnessNotice` (pulau ±1 KB) menampilkan banner "Harga belum diperbarui sejak …" di klien bila halaman ISR lebih tua dari aturan, walau server merendernya saat data masih segar.

- [ ] **Step 1:** Uji untuk setiap fungsi, termasuk data nyata seed:
  - Cabai Δ7 = 0, bawang Δ7 = +6,61%, beras Δ7 = 0 → `topRise` = bawang, `topFall` = null.
  - Rawit tanpa data.
  - Median prediksi 0 → "stabil".
- [ ] **Step 2:** GAGAL → **Step 3:** implementasi → **Step 4:** LULUS.

### Task 4: Grafik

**Files:**

- Create: `apps/web/src/components/charts/{scale.ts,PriceChart.tsx,ForecastChart.tsx,ChartTooltip.tsx,RangeSwitch.tsx,ChartDataTable.tsx}`
- Test: `components/charts/*.test.ts(x)`

**Interfaces (Produces):**

- `scale.ts`:
  - `timeScale(domain: [IsoDate, IsoDate], range: [number, number])`, `linearScale(domain, range, {nice: true})` (rentang 0 → domain ±5% di sekitar nilai).
  - `ticks(…)` (3–4 tanggal, 3 harga).
  - `pathFrom(points, x, y): string` tanpa `NaN`.
- `PriceChart` (Server):
  - Menerima `points365` dan `pointsAll`, lalu merender 4 varian rentang (`30H`, `90H`, `1T`, `Semua`) sebagai `<g data-range>`. Hanya varian bawaan (90H) yang terlihat tanpa JS (CSS `[data-active-range]`).
  - Sumbu harga Rupiah ringkas ("52 rb"), sumbu tanggal WIB.
  - `aria-labelledby` pada judul + ringkasan teks ("Harga naik 7,1% dalam 90 hari, dari … ke …").
- `ForecastChart` (Server):
  - Garis aktual 60 hari terakhir (solid), median prediksi per horizon (putus-putus, `terong-600`), pita q10–q90 (area tipis `terong-100`), penanda hari dasar.
  - Dua varian sumbu waktu: "≤ 30 hari" dan "≤ 1 tahun", dipilih menurut horizon aktif.
  - Tidak dirender sama sekali bila `showNumbers` salah.
- `RangeSwitch` / `HorizonSwitch` (Client): pil yang hanya mengubah `data-active-*` pada pembungkus. Tanpa state data, dengan `aria-pressed`, kurang dari 1 KB.
- `ChartTooltip` (Client): pointer/keyboard di atas SVG → tanggal + harga titik terdekat dari array ringkas di props (≤ 404 titik).
- `ChartDataTable`: `<details>` "Lihat data dalam tabel" (aksesibel, bisa tanpa JS).

- [ ] **Step 1:** Uji:
  - Satu titik → tanpa path, dengan teks "Data belum cukup".
  - Harga datar → path horizontal di tengah, tanpa `NaN`.
  - Celah 11 hari → titik tetap urut tanpa titik sisipan.
  - Kuantil `null` di horizon 180/365 → pita berhenti di horizon terakhir yang diketahui.
  - Status `hidden` → `ForecastChart` tidak merender apa pun.
  - Varian tanpa JS = 90H.
- [ ] **Step 2:** GAGAL → **Step 3:** implementasi → **Step 4:** LULUS.
- [ ] **Step 5 — Checkpoint (pemilik):** `feat(web): logika tampilan, grafik svg server, dan rute data per pasar`

### Task 5: Beranda Publik (`/`) dan Beranda (`/beranda`)

**Files:** `app/page.tsx` (orientasi, statis), `app/[market]/beranda/page.tsx`, molekul/organisme baru bila perlu (`HeroHome`, `HighlightCards`, `PriceGrid`, `ForecastTeaser`, `LearnTeaser`, `CoverageCard`)

**Isi (mengikuti `d_beranda`/`m_beranda`, `m_publik`):**

- **Orientasi `/`:**
  - Hero "Berapa harga cabai hari ini, dan minggu depan?" dengan Kapa halo.
  - "Caranya cukup 3 langkah".
  - Contoh prediksi statis berlabel "contoh". Ini halaman statis tanpa data, jadi contohnya ilustratif dan diberi tanda jelas.
  - "Dari mana harganya?" dan CTA ke `/beranda`.
- **Beranda:**
  - Hero dengan chip tanggal data + "Data demo".
  - Tiga kartu sorotan (`weeklyHighlights`).
  - "Harga hari ini": 5 kartu/baris dengan filter "Semua (5) / Bisa diprediksi (3)" (pulau `CommodityFilter`, Task 6).
  - Widget prediksi satu komoditas (`ForecastChart` ringkas + pil horizon).
  - `KataKapa`, 3 artikel edukasi terbit, kartu cakupan data, `FreshnessNotice`, `Disclaimer`.
- **Data:** `priceSummary` + `forecast` (komoditas sorotan) + `history 90d` (komoditas sorotan) + `articles`. Tepat 4 fetch, semuanya ter-cache bertag.

- [ ] **Step 1:** Uji halaman (render Server Component dengan `api` tiruan):
  - Data seed → bawang "paling naik", "Tidak ada yang turun minggu ini", rawit "—" + "Prediksi menyusul", chip "Data demo" + versi model tampil.
  - Ringkasan `forecastArtifact: null` → tanpa angka prediksi.
- [ ] **Step 2:** GAGAL → **Step 3:** implementasi → **Step 4:** LULUS.
- [ ] **Step 5 — Checkpoint (pemilik):** `feat(web): beranda publik dan beranda dengan data nyata`

### Task 6: Harga (`/harga`) dan Detail (`/harga/[komoditas]`)

**Files:** `app/[market]/harga/page.tsx`, `app/[market]/harga/[commodity]/page.tsx`, `components/organisms/{PriceTable,CommodityFilter(client),ContextSignals,CommodityHeader}.tsx`

- **Harga (`d_harga`/`m_harga`):**
  - Judul + tanggal data + "Bukan harga real-time".
  - `CoverageStrip`.
  - Tabel desktop (tren 30 hari, harga, 7/30 hari, prediksi 7 hari) / baris mobile.
  - `CommodityFilter`: tab Semua/Bisa diprediksi + cari nama. Klien hanya menyembunyikan baris; tanpa JS semua baris tampil.
  - Riwayat 90 hari komoditas teratas + `KataKapa`.
  - Kolom "Peringatan" v0.4 **tidak** ditampilkan (Fase 2). Tautan "Atur peringatan" menuju `/peringatan` (segera hadir).
- **Detail (`d_detail`/`m_detail`):**
  - Breadcrumb, kepala komoditas (harga, Δ7, prediksi 7 hari, tombol "Lihat prediksi").
  - Navigasi bagian (anchor `#ringkasan`, `#riwayat`, `#prediksi`, `#konteks`).
  - Kartu perubahan 1/7/30/90 hari (`changesFromHistory`).
  - `PriceChart` dengan prediksi (bila tersedia), kartu prediksi 7 hari, `KataKapa`.
  - **Konteks:** 4 kartu (Cuaca, Berita & sentimen, Kalender, Biaya distribusi) berstatus "Sinyal konteks menyusul", tanpa angka buatan (desain §10).
  - Komoditas tanpa data → `SystemState` sesuai (`forecast_pending` untuk prediksi, harga "—").
- **Data detail:** `priceSummary`, `history 365d`, `history all`, `forecast`.

- [ ] **Step 1:** Uji:
  - Filter tanpa JS menampilkan semua baris; dengan "Bisa diprediksi" hanya yang `covered`.
  - Detail rawit → tanpa grafik prediksi, dengan pesan menyusul.
  - Detail cabai → perubahan 1/7/30/90 hari dari data seed sesuai perhitungan manual (nilai diuji).
  - Konteks tidak memuat angka.
- [ ] **Step 2:** GAGAL → **Step 3:** implementasi → **Step 4:** LULUS.
- [ ] **Step 5 — Checkpoint (pemilik):** `feat(web): halaman harga dan detail komoditas`

### Task 7: Prediksi (`/prediksi`, `/prediksi/[komoditas]`)

**Files:** `app/[market]/prediksi/page.tsx`, `app/[market]/prediksi/[commodity]/page.tsx`, `components/organisms/{ForecastPanel,ForecastTable,ForecastInfo,CommodityPicker}.tsx`

**Isi (`d_prediksi`/`m_prediksi`):**

- Hero "Prediksi harga hingga 1 tahun" dengan Kapa prediksi.
- `CommodityPicker`: `<select>` native. Saat JS aktif, perubahan berpindah ke `/prediksi/<kode>`; tanpa JS, tersedia daftar tautan.
- Pasar dan hari dasar ditampilkan **sebagai teks**, karena hanya ada satu pasar dan satu bundel aktif.
- `HorizonSwitch` 8 pil; 4 kartu metrik per horizon dirender server dan dipilih dengan CSS.
- `ForecastChart`, tabel 8 horizon (baris aktif ditandai).
- "Info prediksi": hari dasar, horizon, model + versi, data sampai, pasar, "Data demo".
- `KataKapa` cara membaca, kartu Keterbatasan, `Disclaimer`.
- Status `expired` → banner "Prediksi kedaluwarsa" + angka. `hidden`/`unavailable` → `SystemState` tanpa angka. `pending_coverage` → `forecast_pending`.

- [ ] **Step 1:** Uji:
  - Tanpa JS, horizon 7H aktif dan hanya satu set kartu terlihat.
  - Uji status (`expired` berlabel; `hidden` tanpa angka di HTML; diperiksa dengan regex `Rp \d` di bagian prediksi).
  - Picker tanpa JS berisi tautan ke 3 komoditas `covered`.
- [ ] **Step 2:** GAGAL → **Step 3:** implementasi → **Step 4:** LULUS.
- [ ] **Step 5 — Checkpoint (pemilik):** `feat(web): halaman prediksi delapan horizon`

### Task 8: Edukasi (`/edukasi`) dan Artikel (`/edukasi/[slug]`)

**Files:** `app/[market]/edukasi/page.tsx`, `app/[market]/edukasi/[slug]/page.tsx`, `components/organisms/{ArticleBody,ArticleToc,LearningPath,PriceExample}.tsx`, dependensi `react-markdown@10.1.0`

- **Edukasi (`d_edukasi`):** hero, jalur belajar, dan kartu topik dari artikel **terbit** (urut `order`), lalu "Topik lain segera hadir", "Tahukah Anda?", dan "Dari edukasi ke produk".
- **Artikel (`d_artikel`):**
  - Judul, kategori + waktu baca, ilustrasi menurut kategori.
  - `ArticleBody`:
    - `react-markdown` di server dengan `skipHtml`.
    - Elemen yang diizinkan: `h2 h3 p ul ol li strong em a blockquote code`.
    - `a` hanya `http(s)`/relatif, dan tautan luar diberi `rel="noopener noreferrer"`.
    - `h2` diberi `id` slug untuk daftar isi.
  - `ArticleToc` ("Di halaman ini"), `PriceExample` ("Contoh dari data Kawan Pasar", 3 harga + Δ30 dari ringkasan).
  - `KataKapa`, kartu ARIF-Net, artikel berikutnya (terbit), dan "Semua topik edukasi".
- **Penjaga slug (Fokus tinjauan #2):** halaman artikel mengambil `api.articles()` (ter-cache) lebih dulu. Slug yang tidak ada di daftar langsung `notFound()` tanpa memanggil `api.article`. `proxy.ts` sudah menolak slug yang tidak lolos skema. Halaman 404 untuk slug sah yang tak dikenal tetap bisa di-cache per path; batasnya tmpfs 128 MB + rate limit Traefik. Risiko sisa ini dicatat di ADR 0009.

- [ ] **Step 1:** Uji:
  - Markdown berisi `<script>`, `<img onerror>`, tautan `javascript:` → tidak dirender (teks atau dibuang).
  - `## Judul` → `h2#judul` + entri daftar isi.
  - Draf tidak muncul.
  - Slug tak dikenal → `notFound` tanpa memanggil `api.article`.
- [ ] **Step 2:** GAGAL → **Step 3:** implementasi → **Step 4:** LULUS.
- [ ] **Step 5 — Checkpoint (pemilik):** `feat(web): halaman edukasi dan artikel dengan markdown tersanitasi`

### Task 9: Halaman statis — ARIF-Net, Keterbatasan, Pilih Pasar, Lainnya

**Files:** `app/arif-net/page.tsx`, `app/arif-net/keterbatasan/page.tsx`, `app/[market]/pasar/page.tsx` (penyempurnaan), `app/lainnya/page.tsx`, `content/arif-net.ts` (data statis bertipe)

- **ARIF-Net (`d_arif`):**
  - Hero "Kenalan dengan ARIF-Net" (chip "kandidat", "Uji prospektif s.d. 15 Jan 2027"), tiga kartu masalah/apa/hasil.
  - Alur data → model (6 langkah), empat bagian model.
  - **"Seberapa akurat ARIF-Net?"** memakai Tabel 4.5 laporan v04 (relMAE validasi F1–F2, 5 seed): ARIF-Net 0,850; BiLSTM 0,861; Ridge 0,874; Random forest 0,876; LightGBM 0,881; SVR 0,897; GRU 0,911; Temporal fusion transformer 0,911; Persistence 1,000.
    - Sumber disebut di halaman.
    - Catatan wajib bahwa keunggulan atas BiLSTM tipis (0,011) dan uji prospektif masih berjalan.
    - Bar dibuat dengan CSS/SVG, beserta tabel aksesibel.
  - Cakupan bertahap, detail riset berstatus.
- **Keterbatasan (`d_batas`):** 4 kartu batas (Data/Model/Cara membaca/Produk) + tabel "Keputusan yang masih terbuka". Teks diambil dari prototipe dan disesuaikan dengan kondisi nyata, misalnya "Angka saat ini memakai bundel prediksi demo".
- **Pilih Pasar (`m_pasar`):** daftar dengan pasar aktif ditandai ✓ dan pasar lain "Segera" (non-aktif). Tanpa "Simpan pilihan" selama hanya satu pasar tersedia; pemilihan pasar sungguhan menyusul bersama pasar kedua.
- **Lainnya (`m_lainnya`):** Peringatan (segera), Kenalan ARIF-Net, Cakupan data (→ `/pasar`), Edukasi, Mode Analis (segera), kartu versi.

- [ ] **Step 1:** Uji:
  - Angka tabel akurasi sama persis dengan Tabel 4.5 (uji data).
  - Halaman statis tidak memanggil API (build tetap lulus tanpa API).
- [ ] **Step 2:** GAGAL → **Step 3:** implementasi → **Step 4:** LULUS.
- [ ] **Step 5 — Checkpoint (pemilik):** `feat(web): halaman arif-net, keterbatasan, pilih pasar, dan lainnya`

### Task 10: Simulasi pengguna e2e, dokumentasi, dan audit Fase 1C

**Files:**

- Create: `tests/e2e/specs/{journeys,product-rules,no-js}.spec.ts`
- Modify: `tests/e2e/specs/shell.spec.ts` (`PAGES` = semua halaman), `docs/design-system/komponen.md`, `docs/architecture/adr/0009-*.md` (rute baru, risiko slug), `docs/security/` (cookie orientasi), `docs/api/v1.md`, `CHANGELOG.md`
- Create: `docs/audits/fase-1c.md`

**Skenario:**

- **Perjalanan pengguna** (360 dan 1280 px):
  - Kunjungan pertama `/` → "Lihat harga hari ini" → Beranda. Kunjungan berikutnya ke `/` langsung ke Beranda.
  - Beranda → kartu cabai → Detail → "Lihat prediksi" → Prediksi → ganti horizon 30H (kartu dan baris berubah) → ganti komoditas bawang.
  - Edukasi → artikel → "Semua topik".
  - Lainnya → ARIF-Net → Keterbatasan.
- **Aturan produk:**
  - Rawit "—" di semua halaman; tidak ada "Rp 0" di seluruh situs.
  - Setiap halaman berangka prediksi memuat "Data demo", versi model, dan disclaimer.
  - Dengan bundel kedaluwarsa (fixture: `bundle:demo` dengan `issued_at` lama di DB uji e2e), label "Kedaluwarsa" tampil.
  - Teks halaman tidak memuat "karena" dalam konteks harga (daftar pengecualian eksplisit).
- **Tanpa JS:** semua halaman terbaca; grafik 90H dan horizon 7H tampil; filter menampilkan semua.
- **Lebar dan aksesibilitas:** 320–1440 dan teks 200% di semua halaman; axe 0 pelanggaran; anggaran JS ≤ 170 KB per rute.

- [ ] **Step 1:** Tulis spesifikasi → GAGAL pada bagian yang belum ada.
- [ ] **Step 2:** Perbaiki → LULUS.
- [ ] **Step 3:** `pnpm audit:all` → semua gerbang lulus.
- [ ] **Step 4:** Tinjauan independen (model paling mampu) dengan Fokus tinjauan di atas. Penting ke atas diperbaiki RED → GREEN; minor ditunda dan dicatat.
- [ ] **Step 5:** Pemeriksaan visual di browser sungguhan terhadap `shots/` (setiap layar d\_\* dan m\_\*), hasilnya dicatat di audit.
- [ ] **Step 6 — Checkpoint (pemilik):** `docs: uji perjalanan pengguna dan audit fase 1c`

## Di luar lingkup Fase 1C

- Akun, peringatan, WhatsApp, dan tombol "Pantau" yang berfungsi (Fase 2). Di 1C hanya ada tautan ke halaman "segera hadir".
- Mode Analis dan unduhan (Fase 3).
- Lighthouse LCP 4G, uji beban lewat halaman web, validasi ulang p95, dan keputusan replika web (Fase 1D).
- Data konteks (cuaca, berita, kalender, biaya distribusi): kartu tampil berstatus "menyusul".
