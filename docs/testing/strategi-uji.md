# Strategi Uji

## Lapisan

| Lapisan                                    | Alat                                                      | Lokasi                                                      | Perintah                                            |
| ------------------------------------------ | --------------------------------------------------------- | ----------------------------------------------------------- | --------------------------------------------------- |
| Unit TypeScript                            | Vitest 5                                                  | `packages/*/src/**/*.test.ts`, `apps/api/test/**/*.test.ts` | `pnpm test`                                         |
| Integrasi API & database (DB + cache asli) | Vitest 5 + SWC                                            | `apps/api/test/**/*.int.test.ts`                            | `pnpm test:int`                                     |
| Ingest Python (unit + integrasi DB)        | pytest + coverage (≥ 90%)                                 | `services/ingest/tests/`                                    | `uv run pytest --cov=kp_ingest --cov-fail-under=90` |
| Kontrak infrastruktur                      | skrip Node                                                | `scripts/infra-check.mjs`                                   | `pnpm infra:check`                                  |
| Lint & tipe                                | ESLint 10 (type-aware), tsc strict, ruff, mypy `--strict` |                                                             | `pnpm lint`, `pnpm typecheck`                       |
| End-to-end + aksesibilitas                 | Playwright + axe                                          | `tests/e2e/` (Fase 1)                                       |                                                     |
| Beban                                      | k6                                                        | `tests/load/` (Fase 1)                                      |                                                     |

Semua gerbang dijalankan dengan `pnpm audit:all`. Log setiap gerbang ada di `.audit/<gerbang>.log`.

## Prinsip

- **Uji ditulis dulu** dan harus terlihat gagal sebelum implementasi dibuat.
- Uji integrasi memakai PostgreSQL dan Valkey asli dari Docker Compose, bukan mock. Constraint, hak role, dan materialized view hanya terbukti di database sungguhan.
- Basis data uji `kawanpasar_test` dikosongkan dan dimigrasi ulang oleh `resetTestDatabase()` (`apps/api/test/helpers/test-db.ts`). Uji Python membutuhkan basis data yang sudah dimigrasi: `pnpm --filter @kawan-pasar/api db:test:reset`.
- Uji integrasi API berjalan serial (`fileParallelism: false`) karena berbagi satu basis data uji.
- Aturan produk diuji secara eksplisit, misalnya "harga 0 ditolak" (CHECK), "tanpa versi tidak tampil", dan "impor ulang idempoten".
- Keluaran yang bisa memuat rahasia diuji tidak membocorkannya (pesan galat env, CLI ingest, skrip pemeriksa infra).

## Urutan menjalankan dari kondisi bersih

```bash
pnpm install && pnpm env:init && pnpm infra:up
pnpm --filter @kawan-pasar/api db:migrate && pnpm --filter @kawan-pasar/api db:seed
pnpm audit:all
```
