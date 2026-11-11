# ADR 0001 — Monorepo dengan pnpm workspaces + Turborepo

- **Status:** Diterima (11 Nov 2026)

## Konteks

Produk terdiri dari aplikasi web (Next.js), Core API (NestJS), paket bersama (skema kontrak, katalog, token desain), serta dua layanan Python (ingest, model). Skema validasi harus dipakai bersama oleh web dan api untuk validasi ganda.

## Opsi

| Opsi                       | Kelebihan                                                                              | Kekurangan                                                               |
| -------------------------- | -------------------------------------------------------------------------------------- | ------------------------------------------------------------------------ |
| Repo terpisah per aplikasi | Batas tegas                                                                            | Skema bersama harus diterbitkan sebagai paket; versi mudah tidak sinkron |
| Monorepo pnpm + Turborepo  | Paket bersama langsung lewat `workspace:*`; cache tugas; satu lockfile; sesuai laporan | Konfigurasi awal sedikit lebih banyak                                    |
| Monorepo Nx                | Banyak fitur generator                                                                 | Lebih berat, kurva belajar lebih tinggi                                  |

## Keputusan

pnpm workspaces (`apps/*`, `packages/*`) + Turborepo. Layanan Python di `services/` dikelola `uv` dan tidak menjadi bagian dari workspace pnpm. pnpm dipasang dengan `engine-strict` dan `save-exact`, dan gerbang `minimumReleaseAge` bawaan pnpm 11 tetap aktif tanpa pengecualian sebagai perlindungan rantai pasok.

## Konsekuensi

- Semua skrip dijalankan dari root lewat `turbo run`.
- Versi yang baru dirilis (lebih muda dari ambang pnpm) tidak bisa dipasang. Misalnya prettier 3.10.0, yang rilis 11 Nov 2026, diganti 3.9.10.
