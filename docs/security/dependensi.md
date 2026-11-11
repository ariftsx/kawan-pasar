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

## Prosedur peningkatan versi

1. Cek versi stabil terbaru dan tanggal rilisnya (`npm view <pkg> time`).
2. Cek peer dependency semua paket yang terkait.
3. Pasang, lalu jalankan `pnpm audit:all`.
4. Perubahan versi besar (major) dicatat sebagai ADR.
