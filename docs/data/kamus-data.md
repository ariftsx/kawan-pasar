# Kamus Data

Sumber kebenaran skema: `apps/api/src/database/schema/` (Drizzle) dan `apps/api/src/database/migrations/`. Nama kolom di database memakai `snake_case`.

Prinsip yang berlaku di semua tabel:
- Harga disimpan sebagai **integer rupiah** per kg.
- Nilai yang tidak diketahui = `NULL` atau baris yang tidak ada, **tidak pernah 0**. Constraint `CHECK` menolak harga ≤ 0.
- Waktu disimpan sebagai `timestamptz`; tanggal observasi sebagai `date`. Zona bisnis: Asia/Jakarta.

## `markets`

| Kolom | Tipe | Null | Arti / aturan |
|---|---|---|---|
| `id` | smallint identity | tidak | PK |
| `code` | text, unik | tidak | Kode 4 huruf kapital (`PIKJ`); CHECK `^[A-Z]{4}$` |
| `name` | text | tidak | Nama pasar |
| `city` | text | tidak | Kota |
| `status` | `market_status` | tidak | `available` \| `coming_soon` |

## `commodities`

| Kolom | Tipe | Null | Arti / aturan |
|---|---|---|---|
| `id` | smallint identity | tidak | PK |
| `code` | text, unik | tidak | Slug (`cabai-merah-keriting`) |
| `name` | text | tidak | Nama tampilan |
| `source_ref` | text, unik | **ya** | `comcat_id` PIHPS. NULL berarti belum ada sumber data |
| `unit` | text | tidak | Selalu `kg` (CHECK) |
| `model_coverage` | `model_coverage` | tidak | `covered` = diprediksi ARIF-Net; `pending` = "prediksi menyusul" |
| `sort_order` | smallint, unik | tidak | Urutan tampil |

`markets` dan `commodities` diisi dari `packages/catalog` lewat `db:seed`. Seed ini idempoten.

## `price_observations`

| Kolom | Tipe | Null | Arti / aturan |
|---|---|---|---|
| `id` | bigint identity | tidak | PK |
| `market_id` | smallint → `markets.id` | tidak | |
| `commodity_id` | smallint → `commodities.id` | tidak | |
| `observed_on` | date | tidak | Tanggal observasi (hari kerja PIHPS) |
| `price_idr` | integer | tidak | Rupiah per kg; CHECK `> 0` |
| `source` | `price_source` | tidak | `seed_csv` \| `pihps` |
| `ingest_run_id` | bigint → `ingest_runs.id` | ya | Run yang menyisipkan baris ini |
| `created_at` | timestamptz | tidak | |

UNIQUE `(market_id, commodity_id, observed_on)`, yang sekaligus menjadi indeks baca riwayat. Tabel ini **append-only** untuk role ingest: `ingest_w` tidak punya hak UPDATE/DELETE.

## `ingest_runs`

| Kolom | Tipe | Null | Arti |
|---|---|---|---|
| `id` | bigint identity | tidak | PK |
| `source` | `price_source` | tidak | |
| `started_at` / `finished_at` | timestamptz | `finished_at` ya | |
| `status` | `ingest_status` | tidak | `running` \| `succeeded` \| `partial` (ada baris ditolak) \| `failed` |
| `rows_inserted` / `rows_skipped` / `rows_rejected` | integer ≥ 0 | tidak | Baris baru / sudah ada / tidak valid |
| `error` | text | ya | Ringkasan galat (tanpa data pribadi) |

## `forecast_artifacts`

| Kolom | Tipe | Null | Arti / aturan |
|---|---|---|---|
| `id` | bigint identity | tidak | PK |
| `bundle_id` | text, unik | tidak | ID bundel dari pipeline |
| `model_name` | text | tidak | Mis. `arif-net`, atau `demo` |
| `model_version`, `data_version`, `preprocess_version` | text | tidak | Wajib tidak kosong (CHECK). Aturan "tanpa versi, tanpa tampil" |
| `data_cutoff` | timestamptz | tidak | Batas data yang dipakai model |
| `issued_at` | timestamptz | tidak | Waktu penerbitan bundel; dasar aturan umur 8/28 hari |
| `checksum_sha256` | text | tidak | 64 karakter hex (CHECK) |
| `status` | `artifact_status` | tidak | `pending` → `active` \| `rejected`; `active` → `retired` |
| `is_demo` | boolean | tidak | `true` = data demo; UI wajib menampilkan label "Data demo" |
| `created_at` | timestamptz | tidak | |

Partial unique index: hanya **satu** bundel `active` per `model_name`.

## `forecasts`

| Kolom | Tipe | Null | Arti / aturan |
|---|---|---|---|
| `id` | bigint identity | tidak | PK |
| `artifact_id` | bigint → `forecast_artifacts.id` (cascade) | tidak | Prediksi tidak berdiri tanpa bundelnya |
| `market_id`, `commodity_id` | smallint FK | tidak | |
| `base_date` | date | tidak | Hari dasar prediksi |
| `horizon_days` | smallint | tidak | CHECK ∈ {1,3,7,14,30,90,180,365} |
| `q10_change`, `q50_change`, `q90_change` | numeric(9,6) | ya | Perubahan relatif r(t,h); monoton q10 ≤ q50 ≤ q90 (CHECK) |
| `q10_price_idr`, `q50_price_idr`, `q90_price_idr` | integer | ya | Harga prediksi; monoton dan > 0 (CHECK) |
| `eval_status` | `eval_status` | tidak | `available` \| `partial` \| `not_tested` (mis. horizon 180/365 hari) |

UNIQUE `(artifact_id, market_id, commodity_id, horizon_days)`.

## `articles`

| Kolom | Tipe | Null | Arti / aturan |
|---|---|---|---|
| `id` | bigint identity | tidak | PK |
| `slug` | text, unik | tidak | CHECK format slug |
| `category` | `article_category` | tidak | `dasar` \| `prediksi` \| `arif-net` \| `keterbatasan` |
| `title`, `summary` | text | tidak | |
| `body_md` | text | tidak | Markdown, maks. 100.000 karakter; dirender dengan sanitasi whitelist |
| `reading_minutes` | smallint > 0 | tidak | |
| `published_at` | timestamptz | ya | NULL = draf (tidak tampil publik) |
| `updated_at` | timestamptz | tidak | |

## `mv_latest_prices` (materialized view)

| Kolom | Arti |
|---|---|
| `market_id`, `commodity_id` | UNIQUE INDEX, sehingga bisa di-refresh `CONCURRENTLY` |
| `observed_on`, `price_idr` | Observasi terakhir |
| `price_7d_idr` | Harga observasi terakhir pada atau sebelum `observed_on − 7 hari`; NULL bila riwayat kurang |
| `price_30d_idr` | Sama untuk 30 hari |

Di-refresh lewat fungsi `refresh_latest_prices()` (`SECURITY DEFINER`, `search_path` dipin). Fungsi ini dipanggil ingest setiap selesai run.

## Hak akses role

| Role | Dipakai oleh | Hak |
|---|---|---|
| `kp_owner` | Migrasi & seed (langsung ke PostgreSQL :5432) | Pemilik skema |
| `app_rw` | Core API (lewat PgBouncer) | SELECT semua tabel & view; INSERT/UPDATE `forecast_artifacts`, `forecasts`, `articles`. **Tidak** boleh memicu refresh view (migrasi 0002). `statement_timeout` 5 detik |
| `ingest_w` | Layanan ingest (lewat PgBouncer) | SELECT `markets`, `commodities`; INSERT `price_observations`; SELECT/INSERT/UPDATE `ingest_runs`; EXECUTE refresh. `statement_timeout` 60 detik |
| `pgbouncer_auth` | PgBouncer | Hanya EXECUTE `pgbouncer.get_auth()` (terbatas untuk `app_rw`, `ingest_w`) |

Hak ini diuji otomatis di `apps/api/test/database/grants.int.test.ts`.
