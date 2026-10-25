# @kawan-pasar/api

Core API Kawan Pasar: NestJS 12 di atas Fastify, gaya _modular monolith_ (docs 13 Bagian A). Saat ini berupa **skeleton**: konfigurasi, logging, envelope error, guard service token, health probe, dan entrypoint worker. Modul domain menyusul per fitur.

## Menjalankan

```bash
cp .env.example .env                       # isi SERVICE_TOKEN (≥ 32 karakter)
pnpm --filter @kawan-pasar/api build
node --env-file=.env apps/api/dist/main.js    # http://localhost:4000/healthz
node --env-file=.env apps/api/dist/worker.js  # worker BullMQ (belum ada antrean)
pnpm --filter @kawan-pasar/api test           # Vitest: unit + boot via fastify.inject
```

| Env                                     | Wajib | Default            | Isi                                                              |
| --------------------------------------- | ----- | ------------------ | ---------------------------------------------------------------- |
| `SERVICE_TOKEN`                         | ya    | —                  | Secret bersama dengan BFF, ≥ 32 karakter, dirotasi 90 hari       |
| `PORT` · `HOST`                         | tidak | `4000` · `0.0.0.0` | Alamat listen                                                    |
| `LOG_LEVEL`                             | tidak | `info`             | Level pino                                                       |
| `TRUSTED_PROXY_CIDRS`                   | tidak | `10.0.0.0/8`       | Subnet proxy (Traefik) yang header `X-Forwarded-*`-nya dipercaya |
| `NODE_ENV`                              | tidak | `development`      | `development` · `test` · `production`                            |
| `DATABASE_URL`                          | ya    | —                  | `postgres://…`                                                   |
| `VALKEY_CACHE_URL` · `VALKEY_QUEUE_URL` | ya    | —                  | `redis://…`, dua instance terpisah (P-05)                        |
| `MODEL_URL` · `MODEL_HMAC_SECRET`       | ya    | —                  | Model service internal dan secret HMAC (≥ 32 karakter)           |

Env divalidasi zod saat boot (`src/config/env.ts`, satu-satunya tempat membaca `process.env`). Bila ada yang salah, proses berhenti dan menyebut nama key-nya tanpa menampilkan nilainya.

## Perilaku yang dijamin

- **Service token.** Semua route mewajibkan header `X-Service-Token`, kecuali probe yang ditandai `@Probe()` (`/healthz`, `/readyz`). Token dibandingkan dalam waktu konstan (SHA-256 + `timingSafeEqual`).
- **Request ID.** `X-Request-Id` dari BFF dipakai bila aman (`[A-Za-z0-9_-]{1,64}`). Bila tidak ada, dibuat `req_<ULID>`. Nilai yang sama muncul di log, header respons, dan body error.
- **Error.** `AllExceptionsFilter` mengubah setiap kegagalan menjadi envelope docs 08 §8 (`{ data: null, error: { code, message, request_id } }`). Stack hanya masuk log. Pesan framework tidak diteruskan ke klien. Error domain dilempar sebagai `AppError(code, pesan)`.
- **Header.** `@fastify/helmet` aktif tanpa CSP (respons JSON). CORS mati karena API hanya dipanggil oleh BFF.
- **Batas.** Body 64 KB. `trustProxy` hanya untuk subnet di `TRUSTED_PROXY_CIDRS`, tidak pernah `true`.
- **Log.** pino JSON lewat nestjs-pino. Header `authorization`, `cookie`, `x-service-token`, dan `set-cookie` disensor. Probe tidak dicatat.
- **Shutdown.** `SIGTERM` menutup aplikasi dengan rapi; request baru saat penutupan mendapat 503.

`/readyz` memeriksa Postgres, kedua Valkey, dan `/readyz` model-svc secara paralel (timeout 1 s per dependensi). Hanya Postgres yang kritis:

| Kondisi                | HTTP | `status`                                                                                       |
| ---------------------- | ---- | ---------------------------------------------------------------------------------------------- |
| Semua sehat            | 200  | `ok`                                                                                           |
| Valkey atau model mati | 200  | `degraded`: replika tetap menerima trafik, karena harga dan modal masih bisa disajikan (AP-08) |
| Postgres mati          | 503  | `down`                                                                                         |

Klien Postgres (postgres.js, pool 10) dan Valkey (ioredis, tanpa antrean offline) tersambung secara lazy. Aplikasi tetap bisa boot saat dependensi mati, dan koneksi ditutup rapi saat shutdown.

## Endpoint contoh: `GET /v1/outlook/:slug?horizon=`

Rantai F0-X4: BFF web → endpoint ini → `GET /internal/forecasts/:slug` di model-svc.

- Request ke model ditandatangani HMAC (`src/infra/model-client.ts`). Formatnya sama persis dengan `services/model`, dan dibuktikan oleh test vector yang dibuat dari implementasi Python. Timeout baca 1 s.
- Jawaban model divalidasi dengan skema `@kawan-pasar/contracts`. Bila tidak sesuai, hasilnya `422 MODEL_INCOMPATIBLE` dan datanya tidak pernah diteruskan.
- Error kontrak dari model (`ARTIFACT_NOT_FOUND`, `FORECAST_UNAVAILABLE`, …) diteruskan apa adanya. Tanda tangan ditolak, timeout, atau jawaban rusak menjadi `503 MODEL_UNAVAILABLE`.
- Respons memakai envelope docs 08 §3: `data: { status, forecast }`, `meta`, `provenance`, `availability`, `limitations`.

Fitur Outlook penuh (F4) menambahkan publishing gate, status `stale`, dan penyimpanan run.

## TypeScript 7 dan decorator (TS-01)

`tsc` di repo ini adalah TS 7 (`@typescript/native`). Dengan `experimentalDecorators` + `emitDecoratorMetadata`, TS 7 meng-emit `design:paramtypes`, dan transformer Vitest juga. Jadi DI NestJS berbasis tipe constructor berjalan di build maupun test, tanpa fallback ke TS 5.

Konsekuensinya: kelas yang di-inject harus diimpor sebagai **nilai**, bukan `import type`. Kalau tidak, metadata-nya menjadi `Object`. Token non-kelas (mis. `ENV`) tetap memakai `@Inject(TOKEN)`.

`fastify` dipin persis ke versi yang dipakai `@nestjs/platform-fastify`, agar hanya ada satu salinan Fastify di dependency tree.

## Struktur

```text
src/
├── main.ts            bootstrap HTTP
├── worker.ts          entrypoint worker (image sama, CMD berbeda)
├── app.factory.ts     susunan Fastify + Nest, dipakai main.ts dan test
├── app.module.ts      logger, guard & filter global, modul
├── config/            skema env (zod) + ConfigModule (token ENV)
├── common/            AppError, AllExceptionsFilter, ServiceTokenGuard, request id
└── modules/health/    /healthz, /readyz
```
