# ADR 0004 — NestJS dengan adapter Fastify

- **Status:** Diterima (11 Nov 2026)

## Konteks

Core API melayani Next.js (BFF) dan harus menahan beban tinggi dengan latensi rendah. NestJS bisa berjalan di atas Express atau Fastify.

## Opsi

| Opsi              | Kelebihan                                                                                                   | Kekurangan                                                |
| ----------------- | ----------------------------------------------------------------------------------------------------------- | --------------------------------------------------------- |
| Express (default) | Paling banyak contoh dan middleware                                                                         | Throughput lebih rendah, overhead per request lebih besar |
| Fastify           | Throughput lebih tinggi, serialisasi JSON cepat, `inject()` untuk uji tanpa port, batas body/timeout bawaan | Middleware khusus Express tidak bisa dipakai langsung     |

## Keputusan

`@nestjs/platform-fastify`. Baseline yang dipasang di `apps/api/src/app.factory.ts`:

- `bodyLimit` 1 MiB; `connectionTimeout` 10 detik, `requestTimeout` 15 detik, `keepAliveTimeout` 65 detik (lebih panjang dari keep-alive proxy agar tidak terjadi reset koneksi), dan `return503OnClosing` saat shutdown.
- `trustProxy` hanya untuk rentang jaringan privat kontainer, sehingga klien langsung tidak bisa memalsukan `X-Forwarded-For`.
- Request id dibuat server (UUID), dikirim sebagai `x-request-id`, dan tidak pernah diambil dari klien, karena nilainya masuk ke log.
- `@fastify/helmet` dengan CSP `default-src 'none'; frame-ancestors 'none'` (API hanya JSON); HSTS hanya di produksi.
- Logger `nestjs-pino` dengan redaksi header `authorization`, `cookie`, `x-service-token`, `set-cookie`, serta field `password`/`token`.
- Env divalidasi Zod saat start (`src/config/env.ts`). Bila tidak valid, proses berhenti dengan pesan yang hanya menyebut **nama** variabel.
- Readiness `/health/ready` memeriksa database dan cache dengan batas waktu 1,5 detik per pemeriksaan, tanpa membocorkan detail galat. Liveness `/health/live` tidak menyentuh dependensi.
- Klien cache: `enableOfflineQueue: false`, sehingga saat cache mati perintah langsung gagal (dan aplikasi berjalan tanpa cache), bukan menumpuk antrean.

## Konsekuensi

Plugin yang dipakai harus versi Fastify. Uji integrasi memakai `app.inject()`.
