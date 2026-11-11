# Audit Fase 0 — Fondasi

- Tanggal: 11 November 2026
- Rencana: [`docs/plans/2026-11-11-fase-0-fondasi.md`](../plans/2026-11-11-fase-0-fondasi.md)
- Desain: [`docs/design/2026-11-11-kawan-pasar-design.md`](../design/2026-11-11-kawan-pasar-design.md)
- Status: **Lulus. Menunggu tinjauan pemilik sebelum Fase 1.**

## 1. Gerbang mutu (`pnpm audit:all`)

| Gerbang                                    | Hasil | Rincian                                                                                                                                    |
| ------------------------------------------ | ----- | ------------------------------------------------------------------------------------------------------------------------------------------ |
| format (Prettier)                          | Lulus | Seluruh berkas                                                                                                                             |
| lint (ESLint 10, type-aware, strict)       | Lulus | 0 galat; `no-explicit-any`, `no-unsafe-*`, `ban-ts-comment` aktif                                                                          |
| typecheck (TS 6.0.3 strict)                | Lulus | `strict`, `noUncheckedIndexedAccess`, `exactOptionalPropertyTypes`                                                                         |
| unit-tests (Vitest)                        | Lulus | eslint-config 2, catalog 7, api 6                                                                                                          |
| infra (`pnpm infra:check`)                 | Lulus | 17 pemeriksaan: health, auth PgBouncer, auth Valkey, kebijakan eviction, port hanya di 127.0.0.1 dan semuanya ada, header keamanan Traefik |
| integration-tests (DB + cache asli)        | Lulus | api 21: constraint, hak role, materialized view, health, env, CSP                                                                          |
| ingest-tests (pytest)                      | Lulus | 51 uji, cakupan **97,7%** (minimum 90%)                                                                                                    |
| ingest-mypy (`--strict`)                   | Lulus |                                                                                                                                            |
| ingest-ruff                                | Lulus | lint + format                                                                                                                              |
| dependency-audit (`pnpm audit`, moderate+) | Lulus | 0 kerentanan, setelah 2 override dev-only (lihat §4)                                                                                       |
| no-any-scan                                | Lulus | Tidak ada `any`/`@ts-ignore`/`@ts-expect-error` di `apps/`, `packages/`                                                                    |
| no-ai-attribution-scan                     | Lulus | Tidak ada atribusi AI di berkas repo (lihat §6 untuk folder prototipe)                                                                     |

Catatan: satu run audit sempat gagal di `integration-tests` (3 uji, galat `Connection terminated due to connection timeout`) karena build image Docker dan Prettier berjalan bersamaan sehingga mesin sangat sibuk (gerbang `infra` 60 detik, biasanya ±15 detik). Uji integrasi diulang 3× dalam kondisi tenang (21/21 setiap kali), lalu `pnpm audit:all` dijalankan ulang tanpa proses lain: **13/13 lulus**. Kesimpulan: bukan cacat kode. Batas waktu koneksi 5 detik di uji sengaja dipertahankan agar uji gagal cepat, bukan menggantung.

## 2. Simulasi pengguna (operator) dari kondisi bersih

Volume data dihapus dan `.env` dibuat ulang. Langkah di `docs/operations/menjalankan-lokal.md` diikuti kata per kata:

```
pnpm install → pnpm env:init → pnpm infra:up → pnpm infra:check (semua OK)
→ db:migrate → db:seed → pnpm ingest:import  {"inserted": 5859, "rejected": 0, "status": "succeeded"}
→ GET /health/ready  {"status":"ok","checks":{"database":"up","cache":"up"}}
```

Hasil: berhasil tanpa langkah tambahan yang tidak tertulis. Impor ulang menghasilkan `inserted 0, skipped 5859` (idempoten). Isi `mv_latest_prices` cocok dengan CSV: cabai Rp63.150, bawang Rp40.300, beras Rp16.100 per 30 Sep 2026.

## 3. Uji ketahanan (kontainer sungguhan)

| Kejadian                   | `/health/ready`                                        | `/health/live` | API restart? |
| -------------------------- | ------------------------------------------------------ | -------------- | ------------ |
| Normal                     | 200, semua `up`                                        | 200            | —            |
| PgBouncer mati             | 503, `database: down` (≈1,8 detik, sesuai batas probe) | 200            | Tidak        |
| PgBouncer hidup lagi       | 200                                                    | 200            | Tidak        |
| PostgreSQL mati lalu hidup | 503, lalu pulih sendiri                                | 200            | Tidak        |
| Valkey cache mati          | 503, `cache: down`                                     | 200            | Tidak        |
| Valkey cache hidup lagi    | 200                                                    | 200            | Tidak        |

## 4. Temuan selama fase dan perbaikannya

| #   | Tingkat    | Temuan                                                                                                                                              | Perbaikan                                                                                                         | Bukti                                                                                     |
| --- | ---------- | --------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------- |
| 1   | **Kritis** | Proses API **crash** setiap kali PgBouncer/PostgreSQL restart (`Unhandled 'error' event` dari pool `pg`)                                            | `createPool()` memasang listener `error`; koneksi rusak dibuang dan dibuat ulang                                  | Uji `survives an idle connection being dropped` RED→GREEN; uji ketahanan §3               |
| 2   | Tinggi     | Skrip `infra-check` sempat mencetak password di pesan galat (argumen `docker exec -e KEY=nilai`)                                                    | Rahasia dikirim lewat env proses anak (`-e KEY` tanpa nilai), bukan argv; plus `redact()`; `.env` lokal dirotasi  | Keluaran diperiksa tidak memuat nilai `.env`                                              |
| 3   | Tinggi     | `docker compose` yang dijalankan hanya dengan berkas dasar membuat ulang PostgreSQL/PgBouncer **tanpa** port dev, sehingga alat di host menggantung | Satu pintu `scripts/compose.mjs` (selalu dua berkas); `infra-check` kini memeriksa semua port yang diharapkan ada | Simulasi recreate → `FAIL (expected host ports not published: 15432, 16432)` → pulih → OK |
| 4   | Tinggi     | Koneksi psycopg tanpa batas waktu: pytest menggantung 18 menit saat port hilang                                                                     | `connect_timeout=10` (CLI & uji); pool uji TS `connectionTimeoutMillis`; tiap gerbang audit dibatasi 15 menit     | Uji `connection uses a timeout` RED→GREEN                                                 |
| 5   | Sedang     | Readiness melapor cache `down` sesaat setelah boot                                                                                                  | Factory menunggu koneksi pertama Valkey maks. 2 detik; API tetap start bila cache mati                            | Uji `reports ready…` RED→GREEN                                                            |
| 6   | Sedang     | Helmet menggabungkan CSP bawaan (`style-src 'unsafe-inline'`, dll.) ke API JSON                                                                     | `useDefaults: false`, `default-src 'none'; base-uri 'none'; form-action 'none'; frame-ancestors 'none'`           | Uji `locked-down CSP` RED→GREEN                                                           |
| 7   | Sedang     | `pnpm audit`: `minimatch` (GHSA-g3hv-75wg-m249) dan `esbuild` ≤0.24.2, keduanya dev-only                                                            | Override `minimatch` 11.0.4, `esbuild` 0.25.12 (`docs/security/dependensi.md`)                                    | `pnpm audit` 0 kerentanan; lint & drizzle-kit tetap berjalan                              |
| 8   | Rendah     | prettier 3.10.0 dirilis pada hari yang sama (belum teruji)                                                                                          | Dipin 3.9.10; gerbang umur rilis pnpm tetap tanpa pengecualian                                                    | ADR 0001                                                                                  |
| 9   | Rendah     | PostgreSQL bawaan Windows milik pemilik memakai port 5432                                                                                           | Port dev dipindah ke 15432/16432/16379/16380                                                                      | `infra-check` OK                                                                          |
| 10  | Rendah     | Git Bash mengubah argumen `/data/...` menjadi path Windows                                                                                          | `compose.mjs` meneruskan argumen tanpa shell; didokumentasikan                                                    | Impor via `pnpm ingest:import` berhasil                                                   |

## 4b. Tinjauan independen (reviewer terpisah, seluruh Fase 0)

Hasil: **0 kritis, 2 penting, 9 minor**. Temuan penting dan dua minor yang dinilai ulang sebagai penting (karena dampaknya data salah masuk DB dan pelanggaran hak minimum) diperbaiki dengan uji yang gagal lebih dulu:

| Temuan                                                                                                                                                                                 | Dampak                                                      | Perbaikan                                                                                                                                                                                                           | Uji                                              |
| -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------ |
| I1: Galat non-SQL (header CSV berpemisah `;`, berkas CP-1252) atau refresh view yang gagal membuat run tertahan `running` selamanya, view tertinggal, dan CLI menyembunyikan alasannya | Operator tidak tahu impor gagal; data di view tidak sinkron | Semua galat baca/tulis menutup run sebagai `failed` beserta alasannya (commit terpisah); refresh view dijalankan terpisah, juga setelah gagal; CLI menampilkan alasan (kecuali galat psycopg, yang bisa memuat URL) | 4 uji baru di `test_pipeline.py` / `test_cli.py` |
| I2: `"40.000"` (pemisah ribuan Indonesia) diterima sebagai **Rp40**; `1e4`, `40_000` juga diterima                                                                                     | Harga salah tersimpan diam-diam                             | Hanya `^\d+(\.0+)?$`; rentang wajar Rp100–Rp10.000.000                                                                                                                                                              | `test_rejects_locale_separators…`                |
| M1 → penting: tanggal longgar (`"1727654400"` → 2024-09-30, `1900-01-01`)                                                                                                              | Tanggal salah tersimpan                                     | Hanya `YYYY-MM-DD`, minimal 2000-01-01, tidak di masa depan (WIB)                                                                                                                                                   | `test_rejects_dates_that_are_not_strict…`        |
| M3 → penting: role API (`app_rw`) boleh memicu refresh view                                                                                                                            | Role publik dapat memicu kerja berat berulang               | Migrasi `0002_revoke_app_refresh.sql`                                                                                                                                                                               | `grants.int.test.ts`                             |

Temuan minor yang ditunda ke Fase 1 (dicatat, belum diperbaiki):

1. Penolakan "komoditas tidak dikenal" di log tanpa nomor baris.
2. `trustProxy` mencakup seluruh RFC1918. Harus dipersempit ke subnet Traefik **sebelum** rate limit per IP di Fase 1.
3. Password Valkey terlihat di argv proses kontainer (perintah server dan healthcheck).
4. Hardening kontainer: belum ada `cap_drop: [ALL]`, batas memori/pids, digest image; healthcheck PgBouncer hanya cek port.
5. pytest ingest butuh `db:test:reset` lebih dulu (sudah di `strategi-uji.md`, belum di panduan lokal).
6. Seed katalog menambah `sort_order` +1000 pada setiap run untuk komoditas yang dihapus dari katalog (overflow `smallint` setelah ±32 run). Tidak terjadi selama katalog tidak menghapus komoditas.
7. Belum ada CHECK di DB untuk tanggal masa depan dan batas atas harga (saat ini hanya ditegakkan di ingest).

## 5. Keputusan pelaksana (menyimpang dari teks rencana)

| Keputusan                                                                             | Alasan                                                                     | Risiko bila keliru  |
| ------------------------------------------------------------------------------------- | -------------------------------------------------------------------------- | ------------------- |
| Traefik memakai file provider, socket Docker tidak di-mount                           | Akses socket setara root host                                              | Rute ditulis manual |
| PgBouncer memakai `auth_query` + role `pgbouncer_auth`                                | SCRAM multi-role tanpa password aplikasi di berkas                         | Satu role tambahan  |
| Fallback router Traefik (`noop@internal`) di Fase 0                                   | Agar header keamanan entrypoint bisa diuji; diganti router `web` di Fase 1 | Tidak ada           |
| Kolom `ingest_runs.rows_rejected` ditambahkan                                         | Ringkasan run harus sama dengan `IngestResult`                             | Satu kolom          |
| Insert batch = satu `INSERT … SELECT unnest() ON CONFLICT DO NOTHING` per 1.000 baris | Satu round-trip per batch dan jumlah baris yang masuk tepat                | Tidak ada           |
| `PriceSource.kind`                                                                    | Mengisi kolom `source`                                                     | Tidak ada           |
| Kontrak HMAC menambah header `X-KP-Nonce`                                             | Desain mensyaratkan anti-replay dengan nonce                               | Satu header         |
| ESLint mengizinkan class kosong ber-decorator dan variabel berawalan `_`              | Pola modul NestJS                                                          | Tidak ada           |
| `createDb()` tunggal dengan `casing: 'snake_case'`                                    | Pemetaan kolom di runtime harus sama dengan drizzle-kit                    | Tidak ada           |

## 6. Keputusan pemilik setelah audit (12 Nov 2026)

1. `figcraft-Kawan_Pasar/` **diabaikan git** (`.gitignore`). README dan skrip setup di dalamnya menyebut konfigurasi alat AI, dan berkas desainnya besar. Cadangan desain disimpan di luar repo.
2. `data/` **diabaikan git**, kecuali `data/README.md` yang menjelaskan cara mendapatkan dataset.
3. PDF laporan sudah diabaikan oleh pemilik.
4. Seluruh commit dijalankan pemilik sendiri; tidak ada atribusi AI di pesan commit.

## 7. Versi terpasang (dari lockfile)

| Paket                          | Versi                   | Paket                                  | Versi          |
| ------------------------------ | ----------------------- | -------------------------------------- | -------------- |
| typescript                     | 6.0.3                   | @nestjs/core, common, platform-fastify | 12.4.2         |
| fastify                        | 5.12.8                  | @fastify/helmet                        | 13.2.0         |
| drizzle-orm / drizzle-kit      | 0.45.4 / 0.31.11        | pg                                     | 8.23.1         |
| zod                            | 4.6.7                   | ioredis                                | 6.0.0          |
| nestjs-pino / pino / pino-http | 5.3.1 / 10.4.0 / 11.0.0 | vitest                                 | 5.1.0          |
| eslint / typescript-eslint     | 10.14.0 / 8.72.2        | prettier                               | 3.9.10         |
| turbo                          | 2.11.10                 | @swc/core                              | 1.16.22        |
| Python                         | 3.14                    | pydantic / psycopg                     | 2.14.2 / 3.3.7 |
| pytest / mypy / ruff           | 9.2.0 / 2.4.1 / 0.17.3  | uv                                     | 0.13.3         |
| PostgreSQL                     | 18.6 (alpine)           | Valkey                                 | 9 (alpine)     |
| PgBouncer                      | 1.24.1-p1               | Traefik                                | 3.7.18         |

## 8. Risiko yang dibawa ke Fase 1

- **Semua harga berstatus terlambat** (data berakhir 30 Sep 2026) sampai adapter PIHPS dibuat. Ini perilaku yang benar, dan UI Fase 1 harus menampilkannya dengan jelas.
- **Prediksi belum ada.** Bundel demo berlabel "Data demo" dibangkitkan di Fase 1.
- Invalidasi cache web (`revalidateTag`) setelah ingest belum ada karena aplikasi web belum ada; ditambahkan di Fase 1.
- Rate limit per rute (NestJS Throttler di Valkey) dan service-token guard dibuat di Fase 1 bersama endpoint publik pertama.
- Overlay dev-tools menghubungkan API ke jaringan non-internal (untuk port 3001). Hanya berlaku di mesin dev; produksi tidak memakai overlay ini.
