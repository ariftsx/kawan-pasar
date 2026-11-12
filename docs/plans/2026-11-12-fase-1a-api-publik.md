# Fase 1A — API Publik: Rencana Implementasi

**Tujuan:** Core API menyajikan seluruh data yang dibutuhkan halaman publik (pasar, ringkasan harga, riwayat, prediksi, artikel) dengan cepat dan aman di bawah beban. Fase ini juga menyediakan kontrak tipe bersama untuk validasi ganda, cache Valkey yang tahan stampede, rate limit, verifikasi dan promosi bundel prediksi, bundel demo berlabel, konten artikel (1 terbit + 5 draf), serta perbaikan minor bawaan Fase 0.

**Arsitektur:** Semua rute `/v1/*` hanya untuk pemanggil internal bertoken (Next.js BFF di Fase 1B/1C). Setiap endpoint baca = satu query agregat + cache-aside Valkey dengan single-flight. Bundel prediksi (asli atau demo) selalu melewati jalur verifikasi → promosi yang sama. Aturan produk (terlambat, kedaluwarsa, tersembunyi, tidak diketahui = null) dihitung di API, bukan di UI.

**Tech stack:** sama dengan Fase 0 (NestJS 12 + Fastify, Drizzle, Zod 4, ioredis/Valkey, Vitest, Python ingest). Tidak ada dependensi runtime baru; rate limit dan single-flight ditulis sendiri (kecil dan teruji).

**Spec:** `docs/design/2026-11-11-kawan-pasar-design.md` (§3, §6, §8, §9, §12). Kontrak bundel: `docs/data/kontrak-bundel-prediksi.md`. Temuan minor bawaan: `docs/audits/fase-0.md` §4b.

## Batasan global

- Semua batasan global Fase 0 tetap berlaku: tanpa atribusi AI, git oleh pemilik, TS strict tanpa `any`, versi dipin, harga integer rupiah, tidak diketahui = `null`, dan bukan 0.
- Perubahan persen dikirim sebagai **pecahan** (`0.032` = 3,2%) dengan 4 desimal. Format tampilan adalah urusan UI.
- Tanggal = string `YYYY-MM-DD` (zona Asia/Jakarta); waktu = ISO-8601 dengan offset.
- **Harga terlambat**: lebih dari 2 hari kerja (Senin–Jumat) antara observasi terakhir dan hari ini (WIB). Hari libur nasional belum diperhitungkan (didokumentasikan).
- **Prediksi**: komoditas `pending` → status `pending_coverage`; tanpa bundel aktif → `unavailable`; umur bundel > 28 hari → `hidden` (tanpa angka); > 8 hari → `expired` (angka tetap ada, UI wajib memberi label); selain itu `available`.
- Setiap respons prediksi membawa `modelVersion`, `dataVersion`, `preprocessVersion`, `dataCutoff`, `issuedAt`, dan `isDemo`.
- Satu endpoint baca menjalankan **paling banyak 2 query** saat cache kosong, dan **0 query** saat cache terisi (diuji).
- Respons galat tidak pernah memantulkan input mentah atau stack. Format: `{"error":{"code","message","fields?"}}`.
- Bahasa konten artikel tidak kausal dan tidak berisi rekomendasi beli/jual.

## Fokus tinjauan

1. **Cache stampede**: 200 permintaan serentak pada cache kosong → database disentuh **1 kali** per kunci → Task 3.
2. **Valkey mati** → endpoint tetap menjawab dari database (lebih lambat), tidak 500; rate limit fail-open sambil mencatat log → Task 2–3.
3. **Pasar `coming_soon` dan komoditas tanpa data** → 200 dengan `status`/`dataStatus` yang jelas dan `latest: null`, bukan 404 atau 0 → Task 4.
4. **Spoofing IP**: header `X-Forwarded-For` dari klien yang bukan proxy tepercaya tidak mengubah kunci rate limit → Task 2.
5. **Bundel rusak** (checksum salah, horizon asing, kuantil tidak monoton, metadata kosong, umur > 28 hari, komoditas `pending`) → ditolak, bundel aktif sebelumnya tetap aktif → Task 5.

---

### Task 1: Paket `@kawan-pasar/contracts` + koreksi katalog

**Files:**

- Create: `packages/contracts/{package.json,tsconfig.json,tsconfig.build.json,eslint.config.js,vitest.config.ts}`, `packages/contracts/src/{index.ts,common.ts,markets.ts,prices.ts,forecasts.ts,articles.ts,errors.ts,bundle.ts}`
- Test: `packages/contracts/src/contracts.test.ts`
- Modify: `packages/catalog/src/markets.ts` (kota: Kramat Jati → `Jakarta Timur`, Senen → `Jakarta Pusat`, sesuai layar Pilih Pasar), `packages/catalog/src/catalog.test.ts`, `docs/data/katalog.md`

**Interfaces (Produces):**

- `IsoDate` (Zod `z.iso.date()`), `MarketCodeSchema`, `CommodityCodeSchema` (enum dari katalog), `HorizonSchema` (literal union `HORIZONS`).
- `MarketSchema {code,name,city,status}`; `MarketsResponseSchema {items: Market[]}`.
- `PricePointSchema {observedOn: IsoDate, priceIdr: int>0}`.
- `ForecastStatusSchema = 'available'|'expired'|'hidden'|'unavailable'|'pending_coverage'`.
- `CommoditySummarySchema {code,name,unit:'kg',modelCoverage, dataStatus:'fresh'|'stale'|'no_data', latest: PricePoint|null, change7d: number|null, change30d: number|null, sparkline: PricePoint[] (≤30, naik), forecast7d: {status, q50Change: number|null, direction:'up'|'down'|'flat'|null}}`.
- `PriceSummaryResponseSchema {market: Market, latestObservedOn: IsoDate|null, items: CommoditySummary[]}`.
- `HistoryRangeSchema = '30d'|'90d'|'365d'|'all'`; `HistoryQuerySchema {range}` (strict, default `90d`); `HistoryResponseSchema {market, commodity:{code,name}, range, downsampled: boolean, points: PricePoint[]}`.
- `ForecastResponseSchema {market, commodity:{code,name,modelCoverage}, status, artifact: {modelName,modelVersion,dataVersion,preprocessVersion,dataCutoff,issuedAt,isDemo,ageDays}|null, baseDate: IsoDate|null, basePriceIdr: int|null, horizons: ForecastHorizon[]}`; `ForecastHorizon {horizonDays, targetDate, q10Change,q50Change,q90Change: number|null, q10PriceIdr,q50PriceIdr,q90PriceIdr: int|null, evalStatus}`.
- `ArticleCategorySchema`, `ArticleListItemSchema {slug,category,title,summary,readingMinutes,publishedAt}`, `ArticleSchema` (+`bodyMd`, `updatedAt`), `ArticlesQuerySchema {category?}` (strict).
- `ApiErrorSchema {error:{code:'bad_request'|'unauthorized'|'not_found'|'rate_limited'|'internal', message, fields?: string[]}}`.
- `BundleMetadataSchema`, `BundleForecastRowSchema` (kolom persis seperti `docs/data/kontrak-bundel-prediksi.md`; mengecek kuantil monoton dan harga > 0 dengan `superRefine`).
- Semua skema objek memakai `z.strictObject`. Tipe diekspor lewat `z.infer`.

- [ ] **Step 1:** Tulis `contracts.test.ts`:
  - `HistoryQuerySchema` menolak `{range:'7d'}`, menolak properti asing `{range:'30d', x:1}`, dan default `{}` → `{range:'90d'}`.
  - `CommoditySummarySchema` menerima `latest:null, change7d:null`, tetapi menolak `latest:{priceIdr:0}`.
  - `BundleForecastRowSchema` menolak `q10Change 0.05, q50Change 0.02`, menolak `horizon_days 2`, dan menerima semua kuantil kosong.
  - `ApiErrorSchema` menolak `code:'teapot'`.
  - Uji katalog: kota PIKJ = `Jakarta Timur`.
- [ ] **Step 2:** `pnpm --filter @kawan-pasar/contracts test` → GAGAL.
- [ ] **Step 3:** Implementasikan sesuai Interfaces; perbaiki kota di katalog.
- [ ] **Step 4:** Uji LULUS; `pnpm --filter @kawan-pasar/catalog test` LULUS; `db:seed` memperbarui kota (idempoten).
- [ ] **Step 5 — Checkpoint (pemilik):** `feat(contracts): skema kontrak bersama untuk validasi ganda`

### Task 2: Lapisan lintas-fungsi API — galat, validasi, token layanan, rate limit, proxy tepercaya

**Files:**

- Create: `apps/api/src/common/{api-exception.filter.ts,zod-validation.pipe.ts,service-token.guard.ts,rate-limit.guard.ts,client-ip.ts,clock.ts}`
- Modify: `apps/api/src/config/env.ts` (`RATE_LIMIT_PER_MINUTE` default 120, `TRUSTED_PROXY_IPS` daftar IP dipisah koma, default kosong), `apps/api/src/app.factory.ts` (`trustProxy` dari env, bukan seluruh RFC1918 — menutup temuan Fase 0 M4), `apps/api/src/app.module.ts`
- Modify: `infra/compose/docker-compose.yml` (jaringan `backend` subnet tetap `172.30.0.0/24`; `traefik` 172.30.0.2; slot `web` 172.30.0.10 disiapkan untuk Fase 1B; `api` env `TRUSTED_PROXY_IPS=172.30.0.10`)
- Test: `apps/api/test/common/{api-exception.filter.test.ts,service-token.guard.test.ts,client-ip.test.ts}`, `apps/api/test/common/rate-limit.int.test.ts`

**Interfaces (Produces):**

- `ApiExceptionFilter` (global): galat Zod/validasi → 400 `bad_request` + `fields` (nama field saja); `NotFoundException` dan rute tak dikenal → 404 `not_found` (tanpa path); 401 `unauthorized`; 429 `rate_limited` + header `Retry-After`; selain itu 500 `internal` (detail hanya di log).
- `ZodValidationPipe(schema)`: dipakai per parameter `@Query()`/`@Param()`/`@Body()`.
- `ServiceTokenGuard`: header `x-service-token` dibandingkan constant-time (`timingSafeEqual` atas hash SHA-256 kedua sisi). Berlaku untuk `/v1/*` dan `/internal/*`; `/health/*` bebas.
- `clientIp(request): string`: `request.ip` (Fastify sudah menerapkan `trustProxy`).
- `RateLimitGuard`: fixed window 60 detik per `(clientIp, kelompok rute)` dengan `INCR` + `EXPIRE` di Valkey dalam satu `MULTI`. Melebihi → 429. **Valkey galat → fail-open** + `log.warn` (Traefik tetap membatasi di depan).
- `Clock` (token DI `CLOCK`, `{ now(): Date }`) agar logika waktu dapat diuji.

- [ ] **Step 1:** Tulis uji:
  - Filter: `ZodError` → 400 dengan `fields:['range']` dan tanpa nilai input; rute `/v1/tidak-ada` → 404 yang body-nya tidak memuat `tidak-ada`; `Error('db password=…')` → 500 `internal` yang body-nya tidak memuat `password`.
  - Guard token: tanpa header → 401; token salah dengan panjang berbeda → 401 (tanpa exception); token benar → lolos; `/health/live` tanpa token → 200.
  - `client-ip`: uji integrasi Fastify `inject` dengan `remoteAddress:'172.30.0.10'` + `X-Forwarded-For: 1.2.3.4` → `1.2.3.4`; dari `10.9.9.9` (tidak tepercaya) + header yang sama → `10.9.9.9`.
  - Rate limit (Valkey asli, `RATE_LIMIT_PER_MINUTE=3`): permintaan ke-4 dari IP yang sama → 429 dengan `Retry-After`; IP lain tetap 200; dengan `VALKEY_CACHE_URL` ke port mati → semua 200 (fail-open).
- [ ] **Step 2:** `pnpm --filter @kawan-pasar/api test && … test:int` → GAGAL.
- [ ] **Step 3:** Implementasikan. Ubah compose (subnet tetap), lalu `pnpm infra:up`.
- [ ] **Step 4:** Semua uji LULUS; `pnpm infra:check` OK.
- [ ] **Step 5:** ADR `0005-rate-limit-dan-proxy-tepercaya.md`.
- [ ] **Step 6 — Checkpoint (pemilik):** `feat(api): filter galat, token layanan, rate limit, dan proxy tepercaya`

### Task 3: Layanan cache (cache-aside + single-flight) dan invalidasi internal

**Files:**

- Create: `apps/api/src/cache/cache.service.ts`, `apps/api/src/modules/internal/{internal.module.ts,internal.controller.ts}`
- Test: `apps/api/test/cache/cache.service.int.test.ts`, `apps/api/test/internal/invalidate.int.test.ts`

**Interfaces (Produces):**

- `CacheService.getOrLoad<T>(key: string, ttlSeconds: number, schema: z.ZodType<T>, load: () => Promise<T>): Promise<T>`:
  - Kunci diberi prefiks `kp:v1:`.
  - Nilai disimpan sebagai JSON dan **divalidasi ulang dengan `schema` saat dibaca**. Data cache yang rusak dianggap miss.
  - Single-flight in-process: pemanggil serentak untuk kunci yang sama berbagi satu `load()`.
  - Galat Valkey → langsung `load()` (degradasi), tanpa melempar.
- `CacheService.invalidate(scope: 'prices'|'forecasts'|'articles'|'all'): Promise<number>`: menghapus kunci `kp:v1:<scope>:*` lewat `SCAN` (tidak pernah `KEYS`).
- TTL: harga & riwayat 3600 detik, prediksi 3600 detik, artikel 21600 detik (cadangan; invalidasi eksplisit adalah jalur utama).
- `POST /internal/cache/invalidate` body `{scope}` (strict) → `{deleted:number}`. Butuh token layanan.

- [ ] **Step 1:** Tulis uji:
  - 200 panggilan `getOrLoad` serentak pada kunci kosong → `load` terpanggil **1×** dan semua mendapat nilai yang sama.
  - Panggilan berikutnya → `load` 0×.
  - Nilai rusak yang ditanam manual di Valkey (`{"x":1}`) → dianggap miss, `load` dipanggil, lalu ditimpa.
  - Valkey mati → nilai dari `load` tetap dikembalikan.
  - `invalidate('prices')` hanya menghapus kunci `prices`.
  - Endpoint invalidate: tanpa token → 401; `{scope:'x'}` → 400; valid → 200 `{deleted}`.
- [ ] **Step 2:** Uji GAGAL. **Step 3:** Implementasikan. **Step 4:** Uji LULUS.
- [ ] **Step 5 — Checkpoint (pemilik):** `feat(api): cache valkey dengan single-flight dan invalidasi internal`

### Task 4: Endpoint pasar, ringkasan harga, dan riwayat

**Files:**

- Create: `apps/api/src/modules/markets/{markets.module.ts,markets.controller.ts,markets.repository.ts}`, `apps/api/src/modules/prices/{prices.module.ts,prices.controller.ts,prices.service.ts,prices.repository.ts,staleness.ts}`
- Create: `apps/api/test/helpers/query-counter.ts`
- Test: `apps/api/test/prices/staleness.test.ts`, `apps/api/test/prices/prices.int.test.ts`
- Create: `docs/api/v1.md` (kontrak endpoint, contoh respons)

**Interfaces (Produces):**

- `GET /v1/markets` → `MarketsResponse`.
- `GET /v1/markets/:market/prices` → `PriceSummaryResponse`. Pasar tak dikenal → 404; `coming_soon` → 200 dengan `items: []`.
- `GET /v1/markets/:market/commodities/:commodity/history?range=` → `HistoryResponse`. Rentang dihitung mundur dari **observasi terakhir** (bukan hari ini, karena data bisa terlambat). `all` diturunkan ke observasi terakhir per minggu (`downsampled: true`). Komoditas tanpa data → `points: []`.
- `businessDaysBetween(from: string, to: string): number` menghitung hari Senin–Jumat setelah `from` sampai dan termasuk `to`. `dataStatus(latest: string|null, today: string): 'fresh'|'stale'|'no_data'` → `stale` bila > 2.
- Query ringkasan = **satu SQL**: `commodities` LEFT JOIN `mv_latest_prices` + `LATERAL` 30 observasi terakhir (sparkline, diurutkan naik), ditambah **satu SQL** ringkasan prediksi 7 hari dari bundel aktif. Tanpa query per komoditas.
- `change7d = round((price − price_7d) / price_7d, 4)`; null bila referensi null.
- `direction`: `|q50Change| < 0.005` → `flat`.
- Cache: `prices:summary:<market>`, `prices:history:<market>:<commodity>:<range>`.
- `query-counter.ts`: `countingPool(url)` mengembalikan `{pool, count(): number, reset()}` (membungkus `pool.query`), dipakai untuk membangun app di uji.

- [ ] **Step 1:** Tulis `staleness.test.ts`:
  - Jumat `2026-11-06` → Selasa `2026-11-10` = 2 (`fresh`); → Rabu `2026-11-11` = 3 (`stale`).
  - Sabtu → Senin = 1.
  - Tanggal sama = 0.
  - `null` → `no_data`.
- [ ] **Step 2:** Tulis `prices.int.test.ts` (DB uji berisi fixture kecil, Clock tetap `2026-11-11T10:00+07:00`):
  - Ringkasan PIKJ berisi 5 item urut katalog. Cabai: `latest` = observasi terakhir fixture, `change7d` sesuai hitungan tangan, `dataStatus:'stale'`, `sparkline.length ≤ 30` dan naik.
  - Rawit hijau: `latest:null`, `dataStatus:'no_data'`, `change7d:null`, `forecast7d.status:'pending_coverage'`.
  - `PSEN` → 200, `market.status:'coming_soon'`, `items:[]`.
  - `XXXX` → 404.
  - Penghitung query: permintaan pertama ≤ 2 query, permintaan kedua 0 query.
  - Riwayat: `range=30d` hanya berisi titik dalam 30 hari sebelum observasi terakhir; `range=7d` → 400 `fields:['range']`; `all` → `downsampled:true` dan ≤ 1 titik per minggu.
  - Setiap respons lolos `*ResponseSchema.parse` (kontrak).
- [ ] **Step 3:** Uji GAGAL. **Step 4:** Implementasikan. **Step 5:** Uji LULUS.
- [ ] **Step 6:** Tulis `docs/api/v1.md`.
- [ ] **Step 7 — Checkpoint (pemilik):** `feat(api): endpoint pasar, ringkasan harga, dan riwayat`

### Task 5: Verifikasi & promosi bundel + endpoint prediksi

**Files:**

- Create: `apps/api/src/bundles/{bundle-reader.ts,bundle-verifier.ts,bundle-promoter.ts,cli.ts}`, `apps/api/src/modules/forecasts/{forecasts.module.ts,forecasts.controller.ts,forecasts.service.ts,forecasts.repository.ts,forecast-status.ts}`
- Modify: `apps/api/package.json` (skrip `bundle:promote`)
- Test: `apps/api/test/bundles/bundle-verifier.test.ts`, `apps/api/test/bundles/bundle-promoter.int.test.ts`, `apps/api/test/forecasts/forecast-status.test.ts`, `apps/api/test/forecasts/forecasts.int.test.ts`, `apps/api/test/fixtures/bundles/` (dibangkitkan oleh helper uji)

**Interfaces (Produces):**

- `readBundle(dir): Promise<{metadata, rows, checksumOk: boolean}>`: membaca `metadata.json`, `forecasts.csv`, dan `SHA256SUMS`.
- `verifyBundle(bundle, now: Date): VerificationResult = {ok:true} | {ok:false, reasons: string[]}`. Alasan ditolak: checksum, skema (Zod kontrak), komoditas tidak `covered`, pasar tidak `available`, baris ganda (pasar, komoditas, horizon), umur > 28 hari, dan `data_cutoff > issued_at`.
- `promoteBundle(db, dir, now): Promise<{status:'active'|'rejected', bundleId, reasons}>`:
  - Bundel valid: satu transaksi menyisipkan artefak + prediksi, mengubah bundel aktif lama menjadi `retired`, lalu yang baru menjadi `active`.
  - Bundel tidak valid: bila metadata terbaca, dicatat sebagai artefak `rejected`; bundel aktif tidak berubah.
  - Setelah sukses → `CacheService.invalidate('forecasts')` dan `invalidate('prices')`.
- CLI: `pnpm --filter @kawan-pasar/api bundle:promote <dir>`. Kode keluar 0 bila aktif, 2 bila ditolak (alasan dicetak), 1 bila galat. Koneksi DB memakai `DATABASE_URL` (app_rw).
- `forecastStatus(coverage, artifact|null, now): ForecastStatus` sesuai Batasan global; `ageDays = floor((now − issuedAt) / 86 400 000)`.
- `GET /v1/markets/:market/commodities/:commodity/forecast` → `ForecastResponse`:
  - `horizons` terurut naik; `targetDate = baseDate + horizonDays` (hari kalender).
  - `basePriceIdr` = observasi pada `baseDate`, atau null.
  - Untuk `hidden`/`unavailable`/`pending_coverage`, `horizons: []` dan angka null; `artifact` tetap terisi untuk `hidden`/`expired`.
  - Cache `forecasts:<market>:<commodity>`.

- [ ] **Step 1:** Tulis `forecast-status.test.ts`:
  - `pending` → `pending_coverage` (meski ada artefak).
  - Tanpa artefak → `unavailable`.
  - Umur 8 hari → `available`; 9 hari → `expired`; 29 hari → `hidden`.
- [ ] **Step 2:** Tulis `bundle-verifier.test.ts` (bundel fiktif di folder sementara): checksum diubah 1 byte → `reasons` memuat `checksum`; horizon 2 → `schema`; `q10>q50` → `schema`; `cabai-rawit-hijau` → `coverage`; baris ganda → `duplicate`; `issued_at` 30 hari lalu → `age`; bundel bersih → `ok`.
- [ ] **Step 3:** Tulis `bundle-promoter.int.test.ts`:
  - Promosi bundel A → aktif.
  - Bundel B bersih → B aktif dan A `retired`.
  - Bundel C rusak → C `rejected` dan B tetap aktif.
  - Jumlah baris `forecasts` milik B = jumlah baris CSV.
- [ ] **Step 4:** Tulis `forecasts.int.test.ts`:
  - Cabai dengan bundel aktif umur 2 hari → `available`, 8 horizon naik, metadata lengkap, `isDemo` sesuai, `targetDate` benar.
  - Clock maju 10 hari → `expired`; 30 hari → `hidden` (`horizons:[]`).
  - Rawit merah → `pending_coverage`.
  - Lolos `ForecastResponseSchema`.
- [ ] **Step 5:** Uji GAGAL. **Step 6:** Implementasikan. **Step 7:** Uji LULUS.
- [ ] **Step 8 — Checkpoint (pemilik):** `feat(api): verifikasi dan promosi bundel prediksi serta endpoint prediksi`

### Task 6: Bundel demo berlabel "Data demo"

**Files:**

- Create: `apps/api/src/bundles/demo-generator.ts`, skrip `bundle:demo` di `apps/api/package.json`
- Test: `apps/api/test/bundles/demo-generator.test.ts`
- Create: `docs/architecture/adr/0006-bundel-demo.md`

**Interfaces (Produces):**

- `generateDemoBundle(series: Map<CommodityCode, PricePoint[]>, opts: {marketCode, now: Date, lookbackDays: 730}): {metadata, rows}`. Metode **kuantil empiris historis**, yang terdokumentasi sebagai _bukan_ ARIF-Net:
  - Untuk setiap komoditas `covered` dan horizon h: kumpulkan r = P(t′)/P(t) − 1, dengan t′ = observasi terakhir ≤ t + h, untuk setiap t dalam `lookbackDays` sebelum `baseDate`.
  - q10/q50/q90 = kuantil interpolasi linear.
  - Harga = `round(base × (1 + q))`.
  - `eval_status`: h ≤ 30 → `available`, 90 → `partial`, 180/365 → `not_tested`.
- Metadata:
  - `model_name:'demo'`, `model_version:'demo-empirical-quantile-v1'`.
  - `data_version:'seed-csv-<tanggal observasi terakhir>'`, `preprocess_version:'none'`.
  - `data_cutoff` = observasi terakhir 23:59:59+07:00, `issued_at = now`.
  - `bundle_id:'demo-<baseDate>-<8 hex sha256 isi>'`.
  - Artefak di DB ditandai `is_demo = true` oleh promoter bila `model_name === 'demo'`.
- `pnpm --filter @kawan-pasar/api bundle:demo` membaca seri dari DB (app_rw), menulis ke `services/model-arifnet/artifacts/<bundle_id>/`, lalu memanggil `promoteBundle`.

- [ ] **Step 1:** Tulis uji generator dengan seri sintetis deterministik:
  - Seri konstan → semua kuantil 0 dan harga = base.
  - Seri naik linear 1%/hari kerja → q50 horizon 7 > 0 dan monoton q10 ≤ q50 ≤ q90 untuk semua horizon.
  - Komoditas `pending` tidak ikut.
  - 8 horizon per komoditas.
  - `bundle_id` stabil untuk input yang sama.
  - Hasilnya lolos `verifyBundle`.
- [ ] **Step 2:** GAGAL → **Step 3:** implementasi → **Step 4:** LULUS.
- [ ] **Step 5:** Jalankan `bundle:demo` pada DB lokal. Harapan: CLI melaporkan `active`, dan `GET …/cabai-merah-keriting/forecast` mengembalikan `status:'available'`, `artifact.isDemo:true`.
- [ ] **Step 6:** ADR 0006 (mengapa kuantil empiris; label wajib; bundel demo diganti otomatis begitu bundel ARIF-Net asli dipromosikan, karena `model_name` berbeda: endpoint memilih bundel aktif **non-demo** bila ada, selain itu demo).
- [ ] **Step 7 — Checkpoint (pemilik):** `feat(api): bundel prediksi demo berlabel`

### Task 7: Artikel (1 terbit + 5 draf untuk ditinjau)

**Files:**

- Create: `content/articles/{apa-itu-inflasi-pangan.md,inflasi-pangan-bergejolak.md,pola-musiman-harga-pangan.md,cuaca-pasokan-distribusi.md,membaca-prediksi-harga.md,menyusun-anggaran-belanja.md}` (frontmatter: `slug, category, title, summary, readingMinutes, status: published|draft, order`)
- Create: `apps/api/src/database/seed/articles.seed.ts`, skrip `db:seed:articles`; `apps/api/src/modules/articles/{articles.module.ts,articles.controller.ts,articles.repository.ts}`
- Test: `apps/api/test/articles/articles-seed.test.ts`, `apps/api/test/articles/articles.int.test.ts`
- Create: `docs/product/konten-artikel.md` (alur tinjau: ubah `status: draft` → `published`, lalu jalankan seed)

**Interfaces (Produces):**

- Parser frontmatter sederhana tanpa dependensi (blok `---` di awal, `kunci: nilai` satu baris). Nilai divalidasi dengan Zod, dan berkas yang tidak valid → seed gagal dengan nama berkasnya.
- Seed upsert berdasarkan `slug`. `published_at` = waktu seed pertama kali status `published` (tidak berubah di seed berikutnya); draf → `published_at NULL`.
- `GET /v1/articles?category=` → hanya `published_at IS NOT NULL`, urut `order`. `GET /v1/articles/:slug` → draf atau tidak ada → 404.
- Isi:
  - `apa-itu-inflasi-pangan` = teks prototipe (`p6_desktop_b.mjs`) dengan rujukan BPS/BI, status `published`.
  - Lima lainnya ditulis sebagai draf: 300–600 kata, bahasa non-kausal ("cenderung", "sering tercatat"), tanpa rekomendasi transaksi, setiap klaim faktual disertai rujukan lembaga (BPS, BI, BMKG), tanpa angka harga statis (contoh data dirender dari API di Fase 1C).

- [ ] **Step 1:** Uji seed:
  - Berkas tanpa `slug` → galat yang memuat nama berkas.
  - Seed 2× → jumlah tetap 6 dan `published_at` artikel terbit tidak berubah.
  - Draf → `published_at` null.
- [ ] **Step 2:** Uji endpoint:
  - Daftar hanya berisi 1 artikel terbit.
  - Slug draf → 404.
  - `category=xyz` → 400.
  - `slug` dengan karakter aneh (`../x`) → 400/404 tanpa memantulkan input.
- [ ] **Step 3:** GAGAL → **Step 4:** implementasi dan tulis konten → **Step 5:** LULUS.
- [ ] **Step 6 — Checkpoint (pemilik):** `feat(content): artikel edukasi (1 terbit, 5 draf untuk ditinjau)`

### Task 8: Bawaan Fase 0 — ingest, seed, dan constraint DB

**Files:**

- Modify: `services/ingest/src/kp_ingest/{models.py,sources/csv_seed.py,pipeline.py,__main__.py}` (nomor baris dibawa ke penolakan "komoditas tidak dikenal", M2; setelah run `succeeded`/`partial`, CLI memanggil `POST /internal/cache/invalidate {scope:'prices'}` bila `API_INTERNAL_URL` dan `SERVICE_TOKEN` diset, dengan batas waktu 3 detik; gagal → hanya log, karena TTL membatasi kebasian)
- Modify: `apps/api/src/database/seed/catalog.seed.ts` (M8: parkir `sort_order` hanya untuk kode yang ada di katalog)
- Create: migrasi `0003_observation_bounds.sql` (M9: `CHECK (price_idr <= 10000000)`, `CHECK (observed_on >= DATE '2000-01-01')`)
- Modify: `infra/compose/docker-compose.yml` (env ingest `API_INTERNAL_URL=http://api:3001`, `SERVICE_TOKEN`), `docs/operations/menjalankan-lokal.md` (M7: `db:test:reset` sebelum uji Python)
- Test: tambahan di `services/ingest/tests/{test_pipeline.py,test_cli.py}`, `apps/api/test/database/schema.int.test.ts`

- [ ] **Step 1:** Tulis uji:
  - Log penolakan `com_99` memuat `line 3` (pakai `caplog`).
  - CLI memanggil URL invalidasi dengan header token (server HTTP lokal di uji).
  - Server mati → exit tetap 0.
  - Seed katalog 40× → `max(sort_order)` ≤ 5.
  - Insert `price_idr = 10000001` → `23514`; `observed_on = 1999-12-31` → `23514`.
- [ ] **Step 2:** GAGAL → **Step 3:** implementasi → **Step 4:** LULUS.
- [ ] **Step 5 — Checkpoint (pemilik):** `fix: perbaikan minor bawaan fase 0 (ingest, seed, constraint)`

### Task 9: Audit Fase 1A

- [ ] **Step 1:** `pnpm audit:all` → semua gerbang lulus. Gerbang `test:int` kini mencakup seluruh uji Task 2–8.
- [ ] **Step 2:** Simulasi pemanggil (curl dengan token dari `.env`, tanpa mencetak tokennya):
  - Setiap endpoint di `docs/api/v1.md` dipanggil dengan input valid dan tidak valid.
  - Respons dicocokkan dengan dokumen.
  - Tanpa token → 401.
- [ ] **Step 3:** Uji beban kecil API (k6 dalam kontainer `grafana/k6`, versi dipin, di jaringan `backend`): 200 VU × 60 detik ke `/v1/markets/PIKJ/prices` dan riwayat. Sasaran: p95 < 100 ms, error 0%, dan **jumlah query DB selama uji ≤ jumlah kunci cache** (dibuktikan lewat `pg_stat_database.xact_commit` sebelum/sesudah).
- [ ] **Step 4:** Uji ketahanan: Valkey mati → endpoint tetap 200 (dari DB), lalu pulih.
- [ ] **Step 5:** Tulis `docs/audits/fase-1a.md` dan perbarui `CHANGELOG.md`. Tinjauan independen atas Fase 1A, lalu **berhenti untuk tinjauan pemilik**.
