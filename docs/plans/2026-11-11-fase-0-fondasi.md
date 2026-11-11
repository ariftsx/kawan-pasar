# Fase 0 — Fondasi: Rencana Implementasi

**Tujuan:** Membangun fondasi monorepo yang bisa dijalankan lokal: tooling strict, Docker Compose (Traefik, PostgreSQL 18 + PgBouncer, Valkey 9), skema database beserta migrasi, Core API minimal dengan health check, layanan ingest Python yang mengimpor CSV seed, dan kerangka `model-arifnet`. Fase ditutup dengan audit.

**Arsitektur:** Monorepo pnpm + Turborepo. Skema DB dimiliki `apps/api` (Drizzle). Ingest Python menulis langsung ke Postgres dengan role terbatas. Postgres dan Valkey hanya ada di jaringan internal Docker; port dev dibuka ke `127.0.0.1` lewat profil `dev-tools`.

**Tech stack:** Node 24 LTS, pnpm 11, TypeScript 6.0.3, NestJS 12 (adapter Fastify), Drizzle ORM 0.45 + `pg` 8.23, Zod 4.6, Vitest 5.1, ESLint 10 + typescript-eslint 8.72, Python 3.14 + uv 0.13 + pydantic + psycopg 3 + pytest, Docker Compose, PostgreSQL 18-alpine, Valkey 9-alpine, Traefik v3, edoburu/pgbouncer v1.24.1-p1.

**Spec:** `docs/design/2026-11-11-kawan-pasar-design.md` (wajib dibaca bersama rencana ini).

## Batasan global

- Tidak ada atribusi AI/asisten di berkas, komentar, dokumen, maupun pesan commit. Langkah "Checkpoint" hanya **menyarankan** perintah git; pemilik yang menjalankannya.
- TypeScript `strict: true`, `noUncheckedIndexedAccess`, `exactOptionalPropertyTypes`, `noImplicitOverride`, `useUnknownInCatchVariables`. ESLint: `@typescript-eslint/no-explicit-any: error`, `no-unsafe-*: error`, `ban-ts-comment: error`. Tidak boleh ada `any`.
- Versi dipin tepat (tanpa `^`/`~`) di setiap `package.json`; `@types/node` mengikuti Node 24 (`24.x` terbaru).
- Python: `mypy --strict` dan `ruff` lulus; cakupan pytest ingest ≥ 90%.
- Harga disimpan sebagai **integer rupiah**. Tidak diketahui = `NULL`/tidak ada baris, tidak pernah 0.
- Kunci unik observasi: (market_id, commodity_id, observed_on).
- Horizon ∈ {1, 3, 7, 14, 30, 90, 180, 365}; q10 ≤ q50 ≤ q90.
- Zona waktu bisnis: `Asia/Jakarta`; kolom waktu `timestamptz`, tanggal observasi `date`.
- Path proyek mengandung spasi dan titik (`D:\.Capstone dan TA\Kawan Pasar`): setiap skrip wajib mengutip path dan tidak bergantung pada path absolut.
- Rahasia hanya di `.env` (di-ignore git); `.env.example` berisi kunci tanpa nilai rahasia.
- Migrasi dijalankan langsung ke Postgres (role `kp_owner`), **tidak** lewat PgBouncer. Aplikasi terhubung lewat PgBouncer (transaction pooling), sehingga tidak boleh memakai named prepared statement maupun `SET` sesi.

## Fokus tinjauan

1. **CSV dari Windows** (BOM UTF-8, akhir baris CRLF, spasi di sekitar nilai) harus tetap terbaca → diuji di Task 6.
2. **Impor dijalankan dua kali** → baris baru 0, `rows_skipped` = jumlah baris; tidak ada galat → Task 6.
3. **Baris rusak** (`comcat_id` tak dikenal, harga kosong/`abc`/≤0/pecahan seperti `40000.5`, tanggal invalid, tanggal di masa depan) → baris ditolak dan dicatat, status run `partial`, tidak pernah tersimpan sebagai 0 → Task 6.
4. **Env hilang atau invalid saat api start** → proses keluar dengan kode ≠ 0 dan pesan yang menyebut nama variabel, **tanpa** mencetak nilai rahasia → Task 5.
5. **Role DB terbatas**: `ingest_w` tidak bisa UPDATE/DELETE `price_observations` atau membaca tabel lain, dan `app_rw` tidak bisa DDL → Task 3/4.

---

### Task 1: Kerangka monorepo dan tooling strict

**Files:**

- Create: `package.json`, `pnpm-workspace.yaml`, `turbo.json`, `.npmrc`, `.nvmrc` (`24`), `.editorconfig`, `.gitattributes` (`* text=auto eol=lf`), `.gitignore`, `.prettierrc.json`, `.prettierignore`
- Create: `packages/tsconfig/{package.json,base.json,node.json,nextjs.json}`
- Create: `packages/eslint-config/{package.json,index.js}`
- Create: `CONTRIBUTING.md`, `docs/README.md`, `docs/architecture/adr/0001-monorepo-pnpm-turborepo.md`, `docs/architecture/adr/0002-typescript-6.md`
- Test: `packages/eslint-config/test/fixtures/{bad-any.ts,good.ts}`, `packages/eslint-config/test/lint.test.ts`

**Interfaces:**

- Produces: `@kawan-pasar/tsconfig` (preset `base.json`, `node.json`, `nextjs.json`), `@kawan-pasar/eslint-config` (ekspor flat config `default`); skrip root `pnpm lint`, `pnpm typecheck`, `pnpm test`, `pnpm format:check` (semuanya via `turbo run`).

- [ ] **Step 1:** Buat berkas root. `package.json` berisi `"private": true`, `"packageManager": "pnpm@11.15.1"`, `"engines": {"node": ">=24 <25"}`. `.npmrc` berisi `engine-strict=true` dan `save-exact=true`. `.gitignore` mencakup `node_modules`, `.turbo`, `dist`, `.next`, `coverage`, `.env`, `.env.*` (kecuali `!.env.example`), `.venv`, `__pycache__`, `*.log`.
- [ ] **Step 2:** Tulis uji `lint.test.ts`: jalankan ESLint (API `ESLint`) dengan config paket ini. Harapan: `bad-any.ts` (berisi `const x: any = 1` dan `// @ts-ignore`) menghasilkan pesan dengan ruleId `@typescript-eslint/no-explicit-any` dan `@typescript-eslint/ban-ts-comment`; `good.ts` menghasilkan 0 pesan.
- [ ] **Step 3:** Jalankan `pnpm --filter @kawan-pasar/eslint-config test`. Harapan: GAGAL (config belum ada).
- [ ] **Step 4:** Implementasikan `packages/eslint-config/index.js` (flat config, `typescript-eslint` `strictTypeChecked` + `stylisticTypeChecked`, aturan pada Batasan global, `eslint-config-prettier`) dan preset tsconfig dengan opsi strict pada Batasan global (`base.json`: `target ES2023`, `module/moduleResolution NodeNext`, `verbatimModuleSyntax`, `isolatedModules`; `node.json` menambahkan `experimentalDecorators` + `emitDecoratorMetadata` untuk Nest).
- [ ] **Step 5:** Jalankan uji lagi. Harapan: LULUS. Jalankan juga `pnpm install` lalu `pnpm lint && pnpm typecheck`. Harapan: keluar dengan kode 0.
- [ ] **Step 6:** Tulis `CONTRIBUTING.md` (konvensi kode bersih, struktur atomic, larangan `any`, validasi ganda, **larangan atribusi AI**, **git dijalankan pemilik**, format pesan commit Conventional Commits), `docs/README.md` (indeks sesuai §13 spec), serta ADR 0001 dan 0002 (format: konteks → opsi + kelebihan/kekurangan → keputusan → konsekuensi).
- [ ] **Step 7 — Checkpoint (pemilik):** `git add -A ':!data' ':!*.pdf' && git commit -m "chore: kerangka monorepo dan tooling strict"`

### Task 2: Paket `@kawan-pasar/catalog`

**Files:**

- Create: `packages/catalog/{package.json,tsconfig.json,vitest.config.ts}`, `packages/catalog/src/{index.ts,commodities.ts,markets.ts,horizons.ts}`
- Test: `packages/catalog/src/catalog.test.ts`
- Create: `docs/data/katalog.md`

**Interfaces:**

- Produces:
  - `type CommodityCode = 'cabai-merah-keriting' | 'bawang-merah' | 'beras-medium-1' | 'cabai-rawit-hijau' | 'cabai-rawit-merah'`
  - `interface Commodity { readonly code: CommodityCode; readonly name: string; readonly sourceRef: string | null; readonly unit: 'kg'; readonly modelCoverage: 'covered' | 'pending'; readonly sortOrder: number }`
  - `const COMMODITIES: readonly Commodity[]`
  - `type MarketCode = 'PIKJ' | 'PSEN' | 'PITT' | 'PBKS'`
  - `interface Market { readonly code: MarketCode; readonly name: string; readonly city: string; readonly status: 'available' | 'coming_soon' }`
  - `const MARKETS: readonly Market[]`
  - `const HORIZONS = [1, 3, 7, 14, 30, 90, 180, 365] as const; type Horizon = (typeof HORIZONS)[number]`
  - `function findCommodityBySourceRef(ref: string): Commodity | undefined`

- [ ] **Step 1:** Tulis uji: tepat 5 komoditas dengan urutan nama _Cabai merah keriting, Bawang merah, Beras medium I, Cabai rawit hijau, Cabai rawit merah_; `sourceRef` berturut-turut `com_14`, `com_11`, `com_3`, `null`, `null`; `modelCoverage` `covered` untuk tiga pertama dan `pending` untuk sisanya; kode unik. Pasar: `PIKJ` "Pasar Kramat Jati" `available`; `PSEN` "Pasar Senen", `PITT` "Pasar Induk Tanah Tinggi", `PBKS` "Pasar Bekasi", semuanya `coming_soon`. `HORIZONS` sama dengan `[1,3,7,14,30,90,180,365]`. `findCommodityBySourceRef('com_99')` → `undefined`.
- [ ] **Step 2:** Jalankan `pnpm --filter @kawan-pasar/catalog test`. Harapan: GAGAL.
- [ ] **Step 3:** Implementasikan sesuai Interfaces (data `as const satisfies readonly Commodity[]`). Isi kota: Kramat Jati/Senen = "Jakarta", Tanah Tinggi = "Tangerang", Bekasi = "Bekasi".
- [ ] **Step 4:** Jalankan uji. Harapan: LULUS. Tulis `docs/data/katalog.md` (tabel kode ↔ nama ↔ `comcat_id` PIHPS).
- [ ] **Step 5 — Checkpoint (pemilik):** `git commit -m "feat(catalog): katalog komoditas, pasar, dan horizon"`

### Task 3: Infrastruktur Docker Compose

**Files:**

- Create: `infra/compose/docker-compose.yml`, `infra/compose/docker-compose.dev-tools.yml`, `infra/postgres/init/01-roles.sh`, `infra/traefik/traefik.yml`, `infra/traefik/dynamic/middlewares.yml`, `infra/pgbouncer/` (konfigurasi lewat env), `.env.example`
- Create: `scripts/infra-check.mjs`
- Create: `docs/operations/menjalankan-lokal.md`, `docs/architecture/adr/0003-valkey-pgbouncer-traefik.md`

**Interfaces:**

- Produces:
  - Jaringan `edge` (traefik↔web) dan `backend` (`internal: true`; web/api/worker/postgres/pgbouncer/valkey/ingest).
  - Basis data `kawanpasar` dan `kawanpasar_test`; role `kp_owner` (pemilik skema, untuk migrasi), `app_rw`, `ingest_w` (LOGIN, tanpa superuser, `CONNECTION LIMIT` terbatas).
  - Host dev (profil `dev-tools`): Postgres `127.0.0.1:5432`, PgBouncer `127.0.0.1:6432`, valkey-cache `127.0.0.1:6379`, valkey-queue `127.0.0.1:6380`. Traefik: `127.0.0.1:8080` → entrypoint `web`.
  - Env: `POSTGRES_SUPERUSER_PASSWORD`, `KP_OWNER_PASSWORD`, `APP_RW_PASSWORD`, `INGEST_W_PASSWORD`, `VALKEY_PASSWORD`.
  - Skrip `pnpm infra:up`, `pnpm infra:down`, `pnpm infra:check`.

- [ ] **Step 1:** Tulis `scripts/infra-check.mjs` yang memverifikasi: semua kontainer `healthy`; `app_rw` dan `ingest_w` bisa terhubung lewat PgBouncer; Valkey menolak koneksi tanpa password (`NOAUTH`) dan menerima dengan password; hanya port pada Interfaces yang terbuka di host, dan semuanya terikat ke `127.0.0.1`. Keluaran per pemeriksaan `OK`/`FAIL`, kode keluar ≠ 0 bila ada yang gagal.
- [ ] **Step 2:** Jalankan `pnpm infra:check`. Harapan: GAGAL (belum ada kontainer).
- [ ] **Step 3:** Tulis compose. Image dipin: `postgres:18-alpine`, `valkey/valkey:9-alpine` dalam **dua instance**, karena kebijakan eviction berlaku per instance: `valkey-cache` (`--maxmemory 256mb --maxmemory-policy allkeys-lru`) dan `valkey-queue` (`--maxmemory-policy noeviction`, `--appendonly yes`, wajib untuk BullMQ); keduanya `--requirepass`, `edoburu/pgbouncer:v1.24.1-p1` (`POOL_MODE=transaction`, `MAX_CLIENT_CONN=500`, `DEFAULT_POOL_SIZE=20`, `AUTH_TYPE=scram-sha-256`), `traefik:v3` (versi patch dipin saat eksekusi; provider docker dengan `exposedByDefault=false`, dashboard mati, middleware `secure-headers`, `rate-limit` (average 50, burst 100 per IP), `compress`, `buffering` maxRequestBodyBytes 1 MiB). Healthcheck untuk setiap layanan; `restart: unless-stopped`; `security_opt: no-new-privileges:true`; volume bernama untuk data Postgres.
- [ ] **Step 4:** Tulis `01-roles.sh`: buat dua basis data, tiga role dengan password dari env, `REVOKE ALL ON SCHEMA public FROM PUBLIC`, `ALTER ROLE app_rw SET statement_timeout = '5s'`, `ALTER ROLE ingest_w SET statement_timeout = '60s'`. Hak per tabel diberikan oleh migrasi (Task 4).
- [ ] **Step 5:** Jalankan `pnpm infra:up` lalu `pnpm infra:check`. Harapan: semua `OK`.
- [ ] **Step 6:** Tulis `docs/operations/menjalankan-lokal.md` (prasyarat, menyalin `.env.example`, membangkitkan password, perintah, troubleshooting port 5432 bentrok di Windows) dan ADR 0003 (Valkey vs Redis, dua instance Valkey, PgBouncer transaction mode, Traefik).
- [ ] **Step 7 — Checkpoint (pemilik):** `git commit -m "feat(infra): docker compose postgres, pgbouncer, valkey, traefik"`

### Task 4: Skema database dan migrasi (`apps/api/src/database`)

**Files:**

- Create: `apps/api/{package.json,tsconfig.json,vitest.config.ts,drizzle.config.ts}`
- Create: `apps/api/src/database/schema/{enums.ts,markets.ts,commodities.ts,price-observations.ts,ingest-runs.ts,forecast-artifacts.ts,forecasts.ts,articles.ts,index.ts}`
- Create: `apps/api/src/database/migrations/` (dibangkitkan drizzle-kit, plus satu migrasi SQL kustom `0001_views_grants.sql`)
- Create: `apps/api/src/database/seed/catalog.seed.ts`, `apps/api/src/database/migrate.ts`
- Test: `apps/api/test/database/schema.int.test.ts`, `apps/api/test/database/grants.int.test.ts`, `apps/api/test/helpers/test-db.ts`
- Create: `docs/data/kamus-data.md`

**Interfaces:**

- Consumes: `COMMODITIES`, `MARKETS`, `HORIZONS` dari `@kawan-pasar/catalog`; database `kawanpasar_test` dan role dari Task 3.
- Produces:
  - Tabel sesuai spec §8 (nama kolom snake_case persis seperti di spec). Enum PG: `market_status`, `model_coverage`, `artifact_status`, `eval_status`, `article_category`, `ingest_status` (`running` | `succeeded` | `partial` | `failed`), `price_source`.
  - `price_observations.price_idr integer NOT NULL CHECK (price_idr > 0)`; UNIQUE `(market_id, commodity_id, observed_on)`, yang sekaligus menjadi indeks baca (urutan kolom ini dipakai query `ORDER BY observed_on DESC`).
  - `forecasts`: CHECK `horizon_days IN (1,3,7,14,30,90,180,365)`; CHECK `q10_change <= q50_change AND q50_change <= q90_change` (berlaku bila ketiganya tidak null; sama untuk harga); UNIQUE `(artifact_id, market_id, commodity_id, horizon_days)`.
  - `forecast_artifacts`: UNIQUE `bundle_id`; partial unique index `WHERE status = 'active'` per `model_name` (hanya satu bundel aktif).
  - Materialized view `mv_latest_prices(market_id, commodity_id, observed_on, price_idr, price_7d_idr, price_30d_idr)`: `price_7d_idr` = harga observasi terakhir dengan `observed_on <= latest - 7` hari kalender (NULL bila tidak ada); 30d sama. UNIQUE INDEX `(market_id, commodity_id)`.
  - Fungsi `refresh_latest_prices()` `SECURITY DEFINER`, pemilik `kp_owner`, `SET search_path = public`, menjalankan `REFRESH MATERIALIZED VIEW CONCURRENTLY mv_latest_prices`.
  - Hak: `app_rw` → SELECT semua tabel + view; INSERT/UPDATE pada `forecast_artifacts`, `forecasts`, `articles`. `ingest_w` → SELECT `markets`, `commodities`; INSERT `price_observations`; INSERT, UPDATE `ingest_runs`; EXECUTE `refresh_latest_prices()`.
  - Skrip `pnpm --filter @kawan-pasar/api db:generate | db:migrate | db:seed`. `migrate.ts` memakai `DATABASE_MIGRATION_URL` (langsung ke Postgres sebagai `kp_owner`). Seed katalog bersifat idempoten (upsert berdasarkan `code`).

- [ ] **Step 1:** Tulis `schema.int.test.ts` (Vitest, terhadap `kawanpasar_test` yang dimigrasi ulang di `beforeAll`):
  - Insert observasi duplikat (pasar, komoditas, tanggal sama) → galat kode `23505`.
  - Insert `price_idr = 0` → `23514`.
  - Insert forecast `horizon_days = 2` → `23514`; `q10 > q50` → `23514`; ketiga kuantil null → berhasil.
  - Dua artefak `active` untuk `model_name` sama → `23505`.
  - Seed dijalankan dua kali → tetap 5 komoditas dan 4 pasar.
  - Setelah menyisipkan observasi cabai 2026-09-30 = 52.400, 2026-09-23 = 50.780, 2026-08-29 = 48.900, lalu `refresh_latest_prices()` → baris view: `observed_on` 2026-09-30, `price_7d_idr` 50.780, `price_30d_idr` 48.900. Untuk komoditas tanpa riwayat 30 hari → `price_30d_idr` NULL.
- [ ] **Step 2:** Tulis `grants.int.test.ts`: sebagai `ingest_w`, `UPDATE`/`DELETE price_observations` dan `SELECT articles` → `42501`; `INSERT` observasi → berhasil; `SELECT refresh_latest_prices()` → berhasil. Sebagai `app_rw`, `CREATE TABLE x()` dan `DELETE FROM price_observations` → `42501`.
- [ ] **Step 3:** Jalankan `pnpm --filter @kawan-pasar/api test:int`. Harapan: GAGAL.
- [ ] **Step 4:** Implementasikan skema Drizzle, `db:generate`, migrasi kustom `0001_views_grants.sql` (view, fungsi, GRANT), `migrate.ts`, dan seed katalog.
- [ ] **Step 5:** Jalankan uji integrasi. Harapan: LULUS. Jalankan `db:migrate` dan `db:seed` pada `kawanpasar`.
- [ ] **Step 6:** Tulis `docs/data/kamus-data.md` (setiap tabel/kolom: tipe, null/tidak, arti, aturan produk yang ditegakkan).
- [ ] **Step 7 — Checkpoint (pemilik):** `git commit -m "feat(db): skema, migrasi, view harga terakhir, dan hak akses role"`

### Task 5: Core API minimal (NestJS + Fastify) dengan health check

**Files:**

- Create: `apps/api/src/{main.ts,app.module.ts}`, `apps/api/src/config/env.ts`, `apps/api/src/database/database.module.ts`, `apps/api/src/cache/valkey.module.ts`, `apps/api/src/modules/health/{health.module.ts,health.controller.ts}`, `apps/api/Dockerfile`
- Modify: `infra/compose/docker-compose.yml` (layanan `api` di jaringan `backend`, tanpa label Traefik; dev-tools membuka `127.0.0.1:3001`)
- Test: `apps/api/test/config/env.test.ts`, `apps/api/test/health/health.int.test.ts`
- Create: `docs/architecture/adr/0004-nestjs-fastify.md`

**Interfaces:**

- Consumes: skema dari Task 4.
- Produces:
  - `const EnvSchema: z.ZodObject<…>` dan `type Env = z.infer<typeof EnvSchema>`; `function loadEnv(source: NodeJS.ProcessEnv): Env`, yang melempar `EnvValidationError` berisi daftar **nama** variabel yang bermasalah saja. Kunci: `NODE_ENV` (`development` | `test` | `production`), `API_PORT` (default 3001), `DATABASE_URL` (via PgBouncer), `DATABASE_POOL_MAX` (default 10, maks 50), `VALKEY_CACHE_URL`, `VALKEY_QUEUE_URL`, `SERVICE_TOKEN` (min. 32 karakter), `LOG_LEVEL`.
  - Token DI `DRIZZLE` (instans `NodePgDatabase<typeof schema>`) dan `VALKEY_CACHE`.
  - `GET /health/live` → `200 {"status":"ok"}` tanpa akses dependensi. `GET /health/ready` → `200 {"status":"ok","checks":{"database":"up","cache":"up"}}`, atau `503` dengan check yang gagal bernilai `"down"`. Tanpa detail galat atau versi.
  - Baseline: `@fastify/helmet`, `bodyLimit` 1 MiB, `trustProxy` hanya untuk jaringan Traefik, header `x-powered-by` mati, `enableShutdownHooks()` (graceful shutdown menutup pool), logger `nestjs-pino` dengan redaksi `req.headers.authorization`, `req.headers.cookie`, dan `*.password`, serta `x-request-id` per permintaan.
  - Dockerfile multi-stage, user non-root, `NODE_ENV=production`, hanya dependensi produksi.

- [ ] **Step 1:** Tulis `env.test.ts`: env lengkap → objek `Env` dengan `API_PORT` bertipe number; `SERVICE_TOKEN` 10 karakter dan `DATABASE_URL` hilang → `EnvValidationError` yang `.message`-nya memuat `SERVICE_TOKEN` dan `DATABASE_URL` tetapi **tidak** memuat nilai token yang diberikan; `DATABASE_POOL_MAX=500` → galat.
- [ ] **Step 2:** Tulis `health.int.test.ts` (aplikasi Nest via `Test.createTestingModule` + `app.inject`): `/health/live` → 200; `/health/ready` dengan DB dan Valkey hidup → 200 dengan `checks` keduanya `up`; dengan `VALKEY_CACHE_URL` ke port mati → 503 dan `cache: "down"`; respons mana pun tidak memuat header `x-powered-by`.
- [ ] **Step 3:** Jalankan `pnpm --filter @kawan-pasar/api test`. Harapan: GAGAL.
- [ ] **Step 4:** Implementasikan sesuai Interfaces. Pool `pg` diberi `max = DATABASE_POOL_MAX`, `idleTimeoutMillis 30000`, `connectionTimeoutMillis 2000`. Klien Valkey memakai `ioredis` (kompatibel) dengan `enableOfflineQueue: false` agar readiness gagal cepat.
- [ ] **Step 5:** Jalankan uji. Harapan: LULUS. Jalankan `pnpm infra:up` (dengan `api`), lalu `curl -s http://127.0.0.1:3001/health/ready`. Harapan: JSON status `ok`.
- [ ] **Step 6:** Tulis ADR 0004 (Fastify vs Express: throughput lebih tinggi dan validasi bawaan; kompatibilitas middleware Express tidak dibutuhkan).
- [ ] **Step 7 — Checkpoint (pemilik):** `git commit -m "feat(api): core api minimal dengan health check dan baseline keamanan"`

### Task 6: Layanan ingest Python — impor CSV seed

**Files:**

- Create: `services/ingest/{pyproject.toml,uv.lock,README.md,Dockerfile}`, `services/ingest/src/kp_ingest/{__init__.py,__main__.py,config.py,models.py,sources/__init__.py,sources/base.py,sources/csv_seed.py,repository.py,pipeline.py}`
- Test: `services/ingest/tests/{conftest.py,test_csv_seed.py,test_models.py,test_pipeline.py}`, `services/ingest/tests/fixtures/{bom_crlf.csv,bad_rows.csv,small.csv}`
- Modify: `infra/compose/docker-compose.yml` (layanan `ingest` dengan profil `jobs`, mount read-only `data/seed`)
- Create: `docs/data/dataset-seed.md`

**Interfaces:**

- Consumes: tabel, role `ingest_w`, dan `refresh_latest_prices()` dari Task 4.
- Produces:
  - `class RawPriceRow(BaseModel)`: `source_ref: str`, `commodity_name: str`, `observed_on: date`, `price_idr: int`. Validator: `price` string dipangkas spasinya; menerima `"40000"` atau `"40000.0"` → 40000; menolak pecahan (`40000.5`), ≤ 0, non-angka; tanggal di masa depan (setelah hari ini WIB) ditolak.
  - `class PriceSource(Protocol)`: `def rows(self) -> Iterator[RawPriceRow | RowError]`.
  - `@dataclass(frozen=True) class RowError`: `line: int`, `reason: str`.
  - `class CsvSeedSource(PriceSource)`: `__init__(self, path: Path)`; membaca dengan `encoding="utf-8-sig"`, `newline=""`; header wajib `comcat_id,commodity,date,price`.
  - `@dataclass(frozen=True) class IngestResult`: `run_id: int`, `status: Literal["succeeded","partial","failed"]`, `inserted: int`, `skipped: int`, `rejected: int`.
  - `def run_ingest(source: PriceSource, conn: psycopg.Connection, market_code: str = "PIKJ") -> IngestResult`: memetakan `source_ref` → `commodity_id` lewat `commodities.source_ref`; ref tak dikenal → `RowError`; menyisipkan per batch 1.000 baris dengan `INSERT … ON CONFLICT DO NOTHING` (`executemany`); `skipped` = baris valid yang sudah ada; menulis `ingest_runs` di awal (`running`) dan akhir; lalu memanggil `refresh_latest_prices()`. Status `partial` bila `rejected > 0`, `failed` bila ada galat DB (transaksi batch di-rollback, run tetap tercatat).
  - CLI: `python -m kp_ingest import-csv --file <path> [--market PIKJ]`, mencetak ringkasan JSON `IngestResult`. Koneksi dari env `INGEST_DATABASE_URL`.

- [ ] **Step 1:** Tulis `test_models.py`: `"40000.0"` → 40000; `" 52400 "` → 52400; `"40000.5"`, `"0"`, `"-1"`, `"abc"`, `""` → ValidationError; tanggal besok WIB → ValidationError.
- [ ] **Step 2:** Tulis `test_csv_seed.py`: `bom_crlf.csv` (BOM + CRLF, 3 baris) → 3 `RawPriceRow`, `source_ref` baris pertama tepat `"com_14"` (tanpa BOM); header salah → `ValueError` yang menyebut kolom yang hilang; `bad_rows.csv` → `RowError` dengan nomor baris yang benar (header = baris 1).
- [ ] **Step 3:** Tulis `test_pipeline.py` (terhadap `kawanpasar_test` sebagai `ingest_w`, katalog sudah di-seed): impor `small.csv` (10 baris valid) → `inserted 10, skipped 0, status succeeded`; impor ulang → `inserted 0, skipped 10`; `bad_rows.csv` yang memuat `com_99` dan harga `abc` → baris itu `rejected`, status `partial`, dan tidak ada baris ber-`price_idr` 0 di DB; `mv_latest_prices` terisi setelah run; baris `ingest_runs` memuat angka yang sama dengan `IngestResult`.
- [ ] **Step 4:** Jalankan `uv run pytest`. Harapan: GAGAL.
- [ ] **Step 5:** Implementasikan sesuai Interfaces.
- [ ] **Step 6:** Jalankan `uv run pytest --cov=kp_ingest --cov-fail-under=90`, `uv run mypy --strict src`, `uv run ruff check`. Harapan: semua lulus.
- [ ] **Step 7:** Impor dataset nyata: `docker compose --profile jobs run --rm ingest import-csv --file /data/seed/prices_combined.csv`. Harapan: `inserted 5859, rejected 0, status succeeded`. Jalankan ulang: `inserted 0, skipped 5859`.
- [ ] **Step 8:** Tulis `docs/data/dataset-seed.md` (fakta dataset dari spec §5, cara impor, perilaku impor ulang).
- [ ] **Step 9 — Checkpoint (pemilik):** `git commit -m "feat(ingest): impor csv seed harga dengan validasi dan upsert idempoten"`

### Task 7: Kerangka `services/model-arifnet`

**Files:**

- Create: `services/model-arifnet/{README.md,pyproject.toml,.gitkeep di src/kp_model/, tests/, artifacts/}`, `docs/data/kontrak-bundel-prediksi.md`

**Interfaces:**

- Produces: dokumentasi kontrak (bukan kode):
  - Struktur bundel: `forecasts.parquet` atau `forecasts.csv` (kolom: `market_code, commodity_code, base_date, horizon_days, q10_change, q50_change, q90_change, q10_price_idr, q50_price_idr, q90_price_idr, eval_status`), `metadata.json` (`bundle_id, model_name, model_version, data_version, preprocess_version, data_cutoff, issued_at`), dan `SHA256SUMS`.
  - Aturan verifikasi: checksum cocok, skema valid, metadata lengkap, horizon dan kuantil monoton, usia ≤ 28 hari.
  - Kontrak HMAC: header `X-KP-Timestamp` (epoch detik), `X-KP-Signature` = hex HMAC-SHA256 dari `METHOD\nPATH\nTIMESTAMP\nSHA256(body)`, toleransi ±60 detik, nonce anti-replay.

- [ ] **Step 1:** Buat struktur direktori dan `pyproject.toml` minimal (nama paket `kp-model`, Python ≥ 3.14, dependensi FastAPI dideklarasikan tetapi tidak dipasang/dijalankan). README menyatakan dengan jelas: **"Belum dikembangkan. Model ARIF-Net dikerjakan di repositori tim pemodelan; layanan ini hanya menyajikan artefak."**
- [ ] **Step 2:** Tulis `docs/data/kontrak-bundel-prediksi.md` sesuai Interfaces. Verifikasi: kontrak ini konsisten dengan kolom tabel `forecasts`/`forecast_artifacts` di Task 4 (nama dan tipe dicocokkan satu per satu).
- [ ] **Step 3 — Checkpoint (pemilik):** `git commit -m "chore(model): kerangka layanan model arif-net dan kontrak bundel"`

### Task 8: Audit Fase 0

**Files:**

- Create: `scripts/audit.mjs`, `docs/audits/fase-0.md`, `docs/testing/strategi-uji.md`, `CHANGELOG.md`
- Modify: `package.json` root (skrip `audit:all`)

**Interfaces:**

- Produces: `pnpm audit:all`, yang berurutan menjalankan `format:check`, `lint`, `typecheck`, `test`, `test:int`, `pnpm audit --audit-level=moderate`, pytest + mypy + ruff (ingest), `infra:check`, serta pemindaian `any`/`@ts-ignore`/`@ts-expect-error` di `apps/` dan `packages/` (selain fixture uji), dan pemindaian atribusi AI (pola didefinisikan di `scripts/audit.mjs`) di seluruh berkas terlacak. Keluar ≠ 0 bila ada yang gagal.

- [ ] **Step 1:** Tulis `scripts/audit.mjs`, lalu jalankan `pnpm audit:all`. Perbaiki semua temuan sampai lulus.
- [ ] **Step 2:** Simulasi dari kondisi bersih: `pnpm infra:down -v`, ikuti `docs/operations/menjalankan-lokal.md` kata per kata dari awal (salin env, up, migrate, seed, ingest). Harapan: berhasil tanpa langkah yang tidak tertulis. Perbaiki dokumen bila ada yang kurang.
- [ ] **Step 3:** Uji ketahanan sederhana: matikan `valkey-cache` → `/health/ready` 503 dan api tetap hidup; nyalakan lagi → 200 tanpa restart api. Matikan `pgbouncer` → 503; nyalakan → pulih.
- [ ] **Step 4:** Tulis `docs/audits/fase-0.md`: hasil setiap gerbang (perintah + ringkasan keluaran), temuan dan perbaikannya, risiko yang dibawa ke Fase 1, dan versi aktual yang terpasang (dari lockfile). Tulis `docs/testing/strategi-uji.md` dan `CHANGELOG.md` (entri Fase 0).
- [ ] **Step 5 — Berhenti untuk tinjauan pemilik.** Checkpoint (pemilik): `git commit -m "docs: audit fase 0"`.
