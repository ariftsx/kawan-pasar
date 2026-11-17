# Kebijakan Keamanan Dependensi

## Lapisan perlindungan rantai pasok

| Lapisan            | Node (pnpm)                                                                                                                                                          | Python (uv)                                                           |
| ------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------- |
| Versi dipin tepat  | `save-exact=true`, lockfile `pnpm-lock.yaml`                                                                                                                         | `uv.lock`                                                             |
| Umur rilis minimum | Gerbang `minimumReleaseAge` bawaan pnpm 11, **tanpa pengecualian**                                                                                                   | `exclude-newer` di `pyproject.toml` (paket yang lebih baru diabaikan) |
| Skrip instalasi    | Diblokir, kecuali allowlist `allowBuilds` (`@swc/core`, `esbuild`, karena butuh binary native)                                                                       | Tidak ada skrip instalasi                                             |
| Audit kerentanan   | `pnpm audit --audit-level=moderate` di `pnpm audit:all`                                                                                                              | Ditambahkan saat dependensi produksi bertambah                        |
| Image kontainer    | Tag dipin (`postgres:18-alpine`, `valkey/valkey:9-alpine`, `edoburu/pgbouncer:v1.24.1-p1`, `traefik:v3.7.18`, `node:24-alpine`, `python:3.14-slim`); proses non-root |                                                                       |

## Override keamanan aktif

Didefinisikan di `pnpm-workspace.yaml` (`overrides`). Setiap override wajib tercatat di sini.

| Paket                  | Masalah                                                         | Jalur                                                                 | Override                                              | Diverifikasi                                                |
| ---------------------- | --------------------------------------------------------------- | --------------------------------------------------------------------- | ----------------------------------------------------- | ----------------------------------------------------------- |
| `minimatch` ≥7 <11.0.1 | GHSA-g3hv-75wg-m249 (moderate): DoS lewat amplifikasi globparts | `eslint` → `minimatch` (dev-only)                                     | `11.0.4` (rilis 2 Nov 2026, sudah lolos gerbang umur) | `pnpm lint` dan uji `@kawan-pasar/eslint-config` lulus      |
| `esbuild` ≤0.24.2      | Dev server esbuild menerima permintaan lintas situs (moderate)  | `drizzle-kit` → `@esbuild-kit/core-utils` → `esbuild@0.18` (dev-only) | `0.25.12`                                             | `drizzle-kit generate` tetap berjalan ("No schema changes") |

Keduanya hanya ada di dependensi pengembangan dan tidak ikut ke image produksi (`pnpm deploy --prod`). Override tetap dipasang agar gerbang audit bersih dan tidak ada pengecualian yang dibiarkan.

## Dependensi web (Fase 1B)

| Paket                                                                                      | Versi                         | Catatan                                                                                                                                                             |
| ------------------------------------------------------------------------------------------ | ----------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `next`, `@next/eslint-plugin-next`                                                         | 16.4.6                        | Runtime web. `sharp` (dependensi opsional Next) tidak diizinkan menjalankan skrip instalasi, dan memang tidak dibutuhkan: `images.unoptimized`, tanpa gambar raster |
| `react`, `react-dom`                                                                       | 19.3.1                        |                                                                                                                                                                     |
| `tailwindcss`, `@tailwindcss/postcss`                                                      | 4.3.5                         | Build-time saja                                                                                                                                                     |
| `server-only`                                                                              | 0.0.1                         | Mencegah modul server (token, env) ikut ke bundle klien                                                                                                             |
| `@testing-library/react`, `@testing-library/dom`, `happy-dom`, `eslint-plugin-react-hooks` | 16.3.3, 10.4.2, 21.0.4, 7.1.1 | Dev-only                                                                                                                                                            |
| `@playwright/test`, `@axe-core/playwright`                                                 | 1.65.0, 4.14.0                | Dev-only (`tests/e2e`); browser Chromium diunduh sekali dengan `playwright install chromium`                                                                        |

Image `web` hanya memuat output `standalone` Next (dependensi yang benar-benar dipakai saat runtime) dan aset statis. Image berjalan sebagai `node` dengan filesystem read-only.

## Prosedur peningkatan versi

1. Cek versi stabil terbaru dan tanggal rilisnya (`npm view <pkg> time`).
2. Cek peer dependency semua paket yang terkait.
3. Pasang, lalu jalankan `pnpm audit:all`.
4. Perubahan versi besar (major) dicatat sebagai ADR.

## Dependensi web (Fase 1C)

| Paket            | Versi  | Catatan                                                                                                                      |
| ---------------- | ------ | ---------------------------------------------------------------------------------------------------------------------------- |
| `react-markdown` | 10.1.0 | Keputusan pemilik. Dijalankan hanya di server (Server Component), 0 KB di browser. `skipHtml`, daftar putih elemen, URL aman |
| `@types/hast`    | 3.0.5  | Dev-only; tipe pohon HTML yang dipakai renderer artikel                                                                      |

## Dependensi Fase 1D

| Paket                             | Versi  | Catatan                                                                                                                             |
| --------------------------------- | ------ | ----------------------------------------------------------------------------------------------------------------------------------- |
| `ioredis` (web)                   | 6.0.0  | Versi yang sama dengan API. Hanya di cache handler server; tanpa antrean offline, tanpa retry, batas 200 ms per operasi (fail-open) |
| `lighthouse` (`tests/perf`)       | 13.6.0 | Dev-only, tidak pernah ikut image. Telemetri Sentry bawaan tidak aktif kecuali diminta lewat flag (tidak dipakai)                   |
| `@playwright/test` (`tests/perf`) | 1.65.0 | Dev-only; menyediakan Chromium yang sama dengan uji e2e                                                                             |
| `grafana/k6` (image)              | 2.3.0  | Dijalankan di jaringan backend hanya oleh `scripts/loadtest.mjs`                                                                    |
