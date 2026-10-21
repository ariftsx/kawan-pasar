# @kawan-pasar/web

Aplikasi web Kawan Pasar: UI, BFF, dan PWA di Next.js 16 (docs 12). Saat ini berupa **skeleton**: satu halaman contoh DATA DEMO, health check, dan fondasi tampilan berbasis token.

## Menjalankan

```bash
cp .env.example .env.local
pnpm --filter @kawan-pasar/web dev        # http://localhost:3000
pnpm --filter @kawan-pasar/web build
pnpm --filter @kawan-pasar/web test       # Vitest (src/lib)
```

| Env                     | Wajib | Isi                                                                       |
| ----------------------- | ----- | ------------------------------------------------------------------------- |
| `NEXT_PUBLIC_APP_URL`   | ya    | URL publik aplikasi                                                       |
| `NEXT_PUBLIC_DATA_MODE` | ya    | `demo` atau `live`. Mode `demo` memberi label DATA DEMO pada angka contoh |

Env publik divalidasi zod saat boot (`src/lib/env`). Secret **tidak pernah** memakai prefiks `NEXT_PUBLIC_`.

## Struktur

```text
src/
├── app/            layout, halaman, /api/healthz
├── lib/env/        validasi env publik
├── lib/format/     Rp 52.400 · +3,2% · 14 Okt 2026 (id-ID, minus tipografis)
└── styles/         Tailwind v4 + token (@kawan-pasar/tokens)
```
