# Kamus Data

Sumber kebenaran skema: `apps/api/src/database/schema/` (Drizzle) dan `apps/api/src/database/migrations/`. Nama kolom di database memakai `snake_case`.

Prinsip yang berlaku di semua tabel:

- Harga disimpan sebagai **integer rupiah** per kg.
- Nilai yang tidak diketahui = `NULL` atau baris yang tidak ada, **tidak pernah 0**. Constraint `CHECK` menolak harga ≤ 0.
- Waktu disimpan sebagai `timestamptz`; tanggal observasi sebagai `date`. Zona bisnis: Asia/Jakarta.

## `markets`

| Kolom    | Tipe              | Null  | Arti / aturan                                     |
| -------- | ----------------- | ----- | ------------------------------------------------- |
| `id`     | smallint identity | tidak | PK                                                |
| `code`   | text, unik        | tidak | Kode 4 huruf kapital (`PIKJ`); CHECK `^[A-Z]{4}$` |
| `name`   | text              | tidak | Nama pasar                                        |
| `city`   | text              | tidak | Kota                                              |
| `status` | `market_status`   | tidak | `available` \| `coming_soon`                      |

## `commodities`

| Kolom            | Tipe              | Null   | Arti / aturan                                                    |
| ---------------- | ----------------- | ------ | ---------------------------------------------------------------- |
| `id`             | smallint identity | tidak  | PK                                                               |
| `code`           | text, unik        | tidak  | Slug (`cabai-merah-keriting`)                                    |
| `name`           | text              | tidak  | Nama tampilan                                                    |
| `source_ref`     | text, unik        | **ya** | `comcat_id` PIHPS. NULL berarti belum ada sumber data            |
| `unit`           | text              | tidak  | Selalu `kg` (CHECK)                                              |
| `model_coverage` | `model_coverage`  | tidak  | `covered` = diprediksi ARIF-Net; `pending` = "prediksi menyusul" |
| `sort_order`     | smallint, unik    | tidak  | Urutan tampil                                                    |

`markets` dan `commodities` diisi dari `packages/catalog` lewat `db:seed`. Seed ini idempoten.

## `price_observations`

| Kolom           | Tipe                        | Null  | Arti / aturan                        |
| --------------- | --------------------------- | ----- | ------------------------------------ |
| `id`            | bigint identity             | tidak | PK                                   |
| `market_id`     | smallint → `markets.id`     | tidak |                                      |
| `commodity_id`  | smallint → `commodities.id` | tidak |                                      |
| `observed_on`   | date                        | tidak | Tanggal observasi (hari kerja PIHPS) |
| `price_idr`     | integer                     | tidak | Rupiah per kg; CHECK `> 0`           |
| `source`        | `price_source`              | tidak | `seed_csv` \| `pihps`                |
| `ingest_run_id` | bigint → `ingest_runs.id`   | ya    | Run yang menyisipkan baris ini       |
| `created_at`    | timestamptz                 | tidak |                                      |

UNIQUE `(market_id, commodity_id, observed_on)`, yang sekaligus menjadi indeks baca riwayat. Tabel ini **append-only** untuk role ingest: `ingest_w` tidak punya hak UPDATE/DELETE.

## `ingest_runs`

| Kolom                                              | Tipe            | Null             | Arti                                                                  |
| -------------------------------------------------- | --------------- | ---------------- | --------------------------------------------------------------------- |
| `id`                                               | bigint identity | tidak            | PK                                                                    |
| `source`                                           | `price_source`  | tidak            |                                                                       |
| `started_at` / `finished_at`                       | timestamptz     | `finished_at` ya |                                                                       |
| `status`                                           | `ingest_status` | tidak            | `running` \| `succeeded` \| `partial` (ada baris ditolak) \| `failed` |
| `rows_inserted` / `rows_skipped` / `rows_rejected` | integer ≥ 0     | tidak            | Baris baru / sudah ada / tidak valid                                  |
| `error`                                            | text            | ya               | Ringkasan galat (tanpa data pribadi)                                  |

## `forecast_artifacts`

| Kolom                                                 | Tipe              | Null  | Arti / aturan                                                  |
| ----------------------------------------------------- | ----------------- | ----- | -------------------------------------------------------------- |
| `id`                                                  | bigint identity   | tidak | PK                                                             |
| `bundle_id`                                           | text, unik        | tidak | ID bundel dari pipeline                                        |
| `model_name`                                          | text              | tidak | Mis. `arif-net`, atau `demo`                                   |
| `model_version`, `data_version`, `preprocess_version` | text              | tidak | Wajib tidak kosong (CHECK). Aturan "tanpa versi, tanpa tampil" |
| `data_cutoff`                                         | timestamptz       | tidak | Batas data yang dipakai model                                  |
| `issued_at`                                           | timestamptz       | tidak | Waktu penerbitan bundel; dasar aturan umur 8/28 hari           |
| `checksum_sha256`                                     | text              | tidak | 64 karakter hex (CHECK)                                        |
| `status`                                              | `artifact_status` | tidak | `pending` → `active` \| `rejected`; `active` → `retired`       |
| `is_demo`                                             | boolean           | tidak | `true` = data demo; UI wajib menampilkan label "Data demo"     |
| `created_at`                                          | timestamptz       | tidak |                                                                |

Partial unique index: hanya **satu** bundel `active` per `model_name`.

## `forecasts`

| Kolom                                             | Tipe                                       | Null  | Arti / aturan                                                        |
| ------------------------------------------------- | ------------------------------------------ | ----- | -------------------------------------------------------------------- |
| `id`                                              | bigint identity                            | tidak | PK                                                                   |
| `artifact_id`                                     | bigint → `forecast_artifacts.id` (cascade) | tidak | Prediksi tidak berdiri tanpa bundelnya                               |
| `market_id`, `commodity_id`                       | smallint FK                                | tidak |                                                                      |
| `base_date`                                       | date                                       | tidak | Hari dasar prediksi                                                  |
| `horizon_days`                                    | smallint                                   | tidak | CHECK ∈ {1,3,7,14,30,90,180,365}                                     |
| `q10_change`, `q50_change`, `q90_change`          | numeric(9,6)                               | ya    | Perubahan relatif r(t,h); monoton q10 ≤ q50 ≤ q90 (CHECK)            |
| `q10_price_idr`, `q50_price_idr`, `q90_price_idr` | integer                                    | ya    | Harga prediksi; monoton dan > 0 (CHECK)                              |
| `eval_status`                                     | `eval_status`                              | tidak | `available` \| `partial` \| `not_tested` (mis. horizon 180/365 hari) |

UNIQUE `(artifact_id, market_id, commodity_id, horizon_days)`.

## `articles`

| Kolom              | Tipe               | Null  | Arti / aturan                                                        |
| ------------------ | ------------------ | ----- | -------------------------------------------------------------------- |
| `id`               | bigint identity    | tidak | PK                                                                   |
| `slug`             | text, unik         | tidak | CHECK format slug                                                    |
| `category`         | `article_category` | tidak | `dasar` \| `prediksi` \| `arif-net` \| `keterbatasan`                |
| `title`, `summary` | text               | tidak |                                                                      |
| `body_md`          | text               | tidak | Markdown, maks. 100.000 karakter; dirender dengan sanitasi whitelist |
| `reading_minutes`  | smallint > 0       | tidak |                                                                      |
| `published_at`     | timestamptz        | ya    | NULL = draf (tidak tampil publik)                                    |
| `updated_at`       | timestamptz        | tidak |                                                                      |

## `mv_latest_prices` (materialized view)

| Kolom                       | Arti                                                                                        |
| --------------------------- | ------------------------------------------------------------------------------------------- |
| `market_id`, `commodity_id` | UNIQUE INDEX, sehingga bisa di-refresh `CONCURRENTLY`                                       |
| `observed_on`, `price_idr`  | Observasi terakhir                                                                          |
| `price_7d_idr`              | Harga observasi terakhir pada atau sebelum `observed_on − 7 hari`; NULL bila riwayat kurang |
| `price_30d_idr`             | Sama untuk 30 hari                                                                          |

Di-refresh lewat fungsi `refresh_latest_prices()` (`SECURITY DEFINER`, `search_path` dipin). Fungsi ini dipanggil ingest setiap selesai run.

## `users` — kolom nomor HP (Fase 2B)

`phone_nonce` (12 byte), `phone_ciphertext` (AES-256-GCM + tag, AAD = id pengguna), `phone_hmac` (32 byte, untuk pencarian, terindeks). Ketiganya terisi bersama atau kosong bersama (CHECK `users_phone_complete`). Kunci diturunkan dari `PHONE_ENC_KEY` dengan HKDF.

## `alert_preferences`

Satu baris per pengguna (PK `user_id`, cascade). `in_app` (bawaan ya), `weekly` (tidak), `unusual_move`, `forecast_rise`, `price_threshold` (ya), `updated_at`. Tanpa baris = nilai bawaan.

## `alert_watches`

Komoditas yang dipantau: `user_id` (cascade), `market_id`, `commodity_id`, `threshold_idr` (1–10.000.000) + `direction` (`above`/`below`) — keduanya atau tidak sama sekali, `created_at` (pantauan hanya mengabarkan data sesudahnya). Unik per (pengguna, pasar, komoditas); indeks (pasar, komoditas) untuk evaluasi; paling banyak 20 per pengguna.

## `notifications`

Kabar di aplikasi: `kind` (`unusual_move`, `forecast_rise`, `price_threshold`, `weekly`), `commodity_id` (kosong untuk ringkasan), `data_date` (tanggal data; Senin untuk ringkasan), `title` ≤ 160, `body` ≤ 1.200, `link` (path produk saja, CHECK menolak `//host`), `model_version`, `read_at`. Kunci idempoten UNIQUE NULLS NOT DISTINCT (pengguna, jenis, komoditas, tanggal data). Disimpan 180 hari.

## `whatsapp_channels` (Fase 2C)

Satu baris per pengguna (cascade).

| Kolom                                     | Isi                                          |
| ----------------------------------------- | -------------------------------------------- |
| `status`                                  | `pending`, `verified`, atau `stopped`        |
| `phone_hmac`                              | HMAC nomor yang diverifikasi, bukan nomornya |
| `code_hash`                               | HMAC kode                                    |
| `code_expires_at`                         | batas berlaku kode                           |
| `code_attempts`                           | percobaan yang dipakai, 0–5                  |
| `verified_at`, `stopped_at`, `updated_at` | waktu perubahan status                       |

## `whatsapp_messages` (Fase 2C)

Catatan pengiriman untuk batas kirim, disimpan 30 hari:

- `user_id` (set null);
- `phone_hmac`;
- `kind`: `code`, `alerts`, `weekly`, atau `reply`;
- `created_at`.

Tanpa isi pesan dan tanpa nomor. Sejak Fase 2C, `users.phone_key_id` menyimpan id kunci nomor, `alert_preferences.whatsapp` menyimpan sakelar WhatsApp, dan `notifications.sent_whatsapp_at` mencatat kapan kabar terkirim ke WhatsApp.

## `users.role` (Fase 3A)

Enum `user_role`: `user` (bawaan), `analyst` (boleh mengunduh CSV Mode Analis), dan `admin` (Fase 3B). Diubah hanya dari server (`role:grant`, kelak halaman admin).

## `analyst_requests` (Fase 3A)

Pengajuan peran Analis:

- `user_id` (cascade);
- `reason` (10–500 karakter) dan `organization` (opsional, ≤ 120);
- `status`: `pending`, `approved`, atau `rejected`;
- `decided_by` (set null), `decided_at`, `note` (≤ 500, alasan penolakan);
- `created_at`.

Satu pengajuan `pending` per akun (indeks unik parsial `analyst_requests_one_pending`). Terhapus bersama akunnya.

## `audit_log` (Fase 3A)

Jejak tindakan peran dan unduhan:

- `actor_id` (set null; kosong bila dilakukan operator lewat CLI);
- `action`: `role_request`, `role_grant`, `role_revoke`, `role_reject`, `export_prices`, `export_forecasts`;
- `target`: id saja (`user:<uuid>`, `analyst_request:<id>`, `rows:<n>`), tanpa email, nomor HP, atau isi artikel;
- `created_at`.

Hanya bisa ditambah oleh aplikasi (`app_rw`: SELECT, INSERT). Entri lebih dari 365 hari dihapus oleh fungsi `prune_audit_log()` (SECURITY DEFINER) dalam tugas retensi harian, sehingga aplikasi yang disusupi tidak bisa menghapus jejak terbaru.

## Hak akses role

| Role             | Dipakai oleh                                  | Hak                                                                                                                                                                                                                                                                                                                                                                                                 |
| ---------------- | --------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `kp_owner`       | Migrasi & seed (langsung ke PostgreSQL :5432) | Pemilik skema                                                                                                                                                                                                                                                                                                                                                                                       |
| `app_rw`         | Core API (lewat PgBouncer)                    | SELECT semua tabel & view; INSERT/UPDATE `forecast_artifacts`, `forecasts`, `articles`; CRUD `users`, `auth_tokens`, `alert_preferences`, `alert_watches`, `notifications`; SELECT/INSERT/DELETE `auth_events`; SELECT/INSERT/UPDATE `analyst_requests`; SELECT/INSERT `audit_log` dan EXECUTE `prune_audit_log()`. **Tidak** boleh memicu refresh view (migrasi 0002). `statement_timeout` 5 detik |
| `ingest_w`       | Layanan ingest (lewat PgBouncer)              | SELECT `markets`, `commodities`; INSERT `price_observations`; SELECT/INSERT/UPDATE `ingest_runs`; EXECUTE refresh. `statement_timeout` 60 detik                                                                                                                                                                                                                                                     |
| `pgbouncer_auth` | PgBouncer                                     | Hanya EXECUTE `pgbouncer.get_auth()` (terbatas untuk `app_rw`, `ingest_w`)                                                                                                                                                                                                                                                                                                                          |

Hak ini diuji otomatis di `apps/api/test/database/grants.int.test.ts`.
