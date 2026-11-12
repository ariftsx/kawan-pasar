# Strategi Uji

## Lapisan

| Lapisan                                     | Alat                                                      | Lokasi                                                      | Perintah                                            |
| ------------------------------------------- | --------------------------------------------------------- | ----------------------------------------------------------- | --------------------------------------------------- |
| Unit TypeScript                             | Vitest 5                                                  | `packages/*/src/**/*.test.ts`, `apps/api/test/**/*.test.ts` | `pnpm test`                                         |
| Komponen & web (server-only, route handler) | Vitest 5 + Testing Library + happy-dom                    | `apps/web/src/**/*.test.{ts,tsx}`                           | `pnpm --filter @kawan-pasar/web test`               |
| Build web tanpa API                         | `next build` (tanpa `.env`)                               | `apps/web`                                                  | `pnpm --filter @kawan-pasar/web build`              |
| Integrasi API & database (DB + cache asli)  | Vitest 5 + SWC                                            | `apps/api/test/**/*.int.test.ts`                            | `pnpm test:int`                                     |
| Ingest Python (unit + integrasi DB)         | pytest + coverage (≥ 90%)                                 | `services/ingest/tests/`                                    | `uv run pytest --cov=kp_ingest --cov-fail-under=90` |
| Kontrak infrastruktur                       | skrip Node                                                | `scripts/infra-check.mjs`                                   | `pnpm infra:check`                                  |
| Lint & tipe                                 | ESLint 10 (type-aware), tsc strict, ruff, mypy `--strict` |                                                             | `pnpm lint`, `pnpm typecheck`                       |
| End-to-end + aksesibilitas                  | Playwright 1.65 + axe 4.14 (lewat Traefik :8080)          | `tests/e2e/specs/`                                          | `pnpm --filter @kawan-pasar/e2e e2e`                |
| Beban                                       | k6                                                        | `tests/load/` (Fase 1)                                      |                                                     |

Semua gerbang dijalankan dengan `pnpm audit:all`. Log setiap gerbang ada di `.audit/<gerbang>.log`.

## Prinsip

- **Uji ditulis dulu** dan harus terlihat gagal sebelum implementasi dibuat.
- Uji integrasi memakai PostgreSQL dan Valkey asli dari Docker Compose, bukan mock. Constraint, hak role, dan materialized view hanya terbukti di database sungguhan.
- Basis data uji `kawanpasar_test` dikosongkan dan dimigrasi ulang oleh `resetTestDatabase()` (`apps/api/test/helpers/test-db.ts`). Uji Python membutuhkan basis data yang sudah dimigrasi: `pnpm --filter @kawan-pasar/api db:test:reset`.
- Uji integrasi API berjalan serial (`fileParallelism: false`) karena berbagi satu basis data uji.
- Aturan produk diuji secara eksplisit, misalnya "harga 0 ditolak" (CHECK), "tanpa versi tidak tampil", dan "impor ulang idempoten".
- Keluaran yang bisa memuat rahasia diuji tidak membocorkannya (pesan galat env, CLI ingest, skrip pemeriksa infra, log klien API web).
- Uji integrasi API memakai **database Valkey 15** (`test/helpers/load-env.ts`), bukan database 0 milik tumpukan dev. Sebelum Fase 1C keduanya berbagi database 0, sehingga data uji (bundel prediksi uji) sempat tersaji oleh API dev.
- Spesifikasi e2e: `shell` (lebar layar, axe, teks 200%, reflow 320 px, gerak, anggaran JS), `journeys` (alur pengguna 360/1280 px), `product-rules` (tidak ada "Rp 0", versi model + "Data demo" + disclaimer, bahasa non-kausal, pemberitahuan data terlambat), dan `no-js` (semua halaman tanpa JavaScript).
- Uji e2e berjalan terhadap kontainer sungguhan yang dibangun ulang oleh `audit:all` (`stack-rebuild`), jadi yang diuji adalah image yang akan dijalankan, bukan server dev.
- Uji komponen memeriksa aturan produk di tingkat tampilan: `null` → "—" (tidak pernah "Rp 0"), label "Kedaluwarsa"/"Data demo", dan arah perubahan yang tidak hanya berupa warna.

## Urutan menjalankan dari kondisi bersih

```bash
pnpm install && pnpm env:init && pnpm infra:up
pnpm --filter @kawan-pasar/api db:migrate && pnpm --filter @kawan-pasar/api db:seed
pnpm audit:all
```
