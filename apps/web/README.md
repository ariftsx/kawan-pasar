# @kawan-pasar/web

Aplikasi web Kawan Pasar: UI, BFF, dan PWA di Next.js 16 (docs 12). Saat ini berupa **skeleton**: satu halaman contoh DATA DEMO, health check, dan seluruh fondasi keamanan.

## Menjalankan

```bash
cp .env.example .env.local
pnpm --filter @kawan-pasar/web dev        # http://localhost:3000
pnpm --filter @kawan-pasar/web build
pnpm --filter @kawan-pasar/web test       # Vitest (src/lib)
pnpm --filter @kawan-pasar/web test:e2e   # Playwright smoke (butuh build)
```

| Env                     | Wajib       | Isi                                                                       |
| ----------------------- | ----------- | ------------------------------------------------------------------------- |
| `NEXT_PUBLIC_APP_URL`   | ya          | URL publik aplikasi                                                       |
| `NEXT_PUBLIC_DATA_MODE` | ya          | `demo` atau `live`. Mode `demo` memberi label DATA DEMO pada angka contoh |
| `API_INTERNAL_URL`      | ya (server) | URL core API di jaringan internal, mis. `http://api:4000`                 |
| `SERVICE_TOKEN`         | ya (server) | Secret bersama api; dibaca saat dipakai pertama kali, tidak saat build    |

Env publik divalidasi zod saat boot (`src/lib/env`). Secret **tidak pernah** memakai prefiks `NEXT_PUBLIC_`.

## BFF

`/bff/*` adalah Route Handler yang hanya meneruskan request ke core API (docs 12 §5). Aturan bisnis tetap di `apps/api`.

- `src/lib/api/client.ts` (server-only) menyertakan `X-Service-Token` dan `X-Request-Id`, dengan timeout 3 s dan satu kali retry hanya untuk GET. API yang tidak terjangkau dikembalikan sebagai envelope `503 DEPENDENCY_UNAVAILABLE`.
- `GET /bff/outlook/[slug]?horizon=` adalah contoh rantai F0-X4.

## Keamanan

- `src/proxy.ts` membuat **nonce CSP per request** (128-bit) dan memasang header docs 15 §10: HSTS, `nosniff`, Referrer-Policy, Permissions-Policy, COOP, CORP. `X-Powered-By` dimatikan.
- Root layout memakai `instant = false` + `connection()`, sehingga **semua halaman dirender per request**. Shell yang di-prerender tidak membawa nonce, dan browser akan memblokir semua script-nya. Data tetap bisa di-cache dengan `'use cache'` (Cache Components aktif). HTML yang di-cache di edge masih OPEN CSP-01.
- `dangerouslySetInnerHTML` dilarang oleh lint.

## Struktur

```text
src/
├── app/            layout, halaman, /api/healthz
├── app/bff/        Route Handler BFF → core API
├── lib/api/        klien server-only ke core API
├── lib/env/        validasi env publik dan server
├── lib/format/     Rp 52.400 · +3,2% · 14 Okt 2026 (id-ID, minus tipografis)
├── lib/security/   CSP + header keamanan
├── proxy.ts        nonce + header per request
└── styles/         Tailwind v4 + token (@kawan-pasar/tokens)
e2e/                smoke: health, nonce di setiap <script>, header, kartu DATA DEMO
```
