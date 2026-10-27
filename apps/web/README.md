# @kawan-pasar/web

Aplikasi web Kawan Pasar: UI, BFF, dan PWA di Next.js 16 (docs 12). Saat ini berisi golden path **mode tamu** (F1): Atur Warung → Beranda → Rencana Menu → Rincian Menu. Data disimpan di perangkat (IndexedDB), tanpa login.

## Menjalankan

```bash
cp .env.example .env.local
pnpm --filter @kawan-pasar/web dev        # http://localhost:3000
pnpm --filter @kawan-pasar/web build
pnpm --filter @kawan-pasar/web test       # Vitest (src/lib)
pnpm --filter @kawan-pasar/web exec playwright install chromium   # sekali
pnpm --filter @kawan-pasar/web test:e2e   # Playwright: smoke + golden path (butuh build)
E2E_BASE_URL=http://localhost:3000 pnpm --filter @kawan-pasar/web test:e2e  # terhadap stack yang sedang jalan
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

## Alur data mode tamu

```text
IndexedDB (lib/guest-store) ─► features/planning/guest-plan.tsx (context)
packages/catalog (resep, harga DATA DEMO) ─┐
/bff/outlook (perkiraan 7 hari) ───────────┼─► lib/planning/plan.ts ─► packages/domain ─► layar
NEXT_PUBLIC_DATA_MODE (demo | live) ───────┘
```

- `lib/guest-store`: repository IndexedDB dengan validasi zod, versi skema, dan ekspor JSON. Antarmuka `PlanningRepository` memungkinkan F3 beralih ke API setelah login tanpa mengubah layar.
- `lib/planning/plan.ts`: memilih harga dan perkiraan untuk setiap bahan, lalu menyusun baris resep untuk `packages/domain`. Fungsi yang sama meringkas seluruh rencana.
- `lib/planning/view.ts`: nilai tampilan. Semua "tidak diketahui" diputuskan di sini menjadi `null` (tampil "—"), tidak pernah 0.
- Bila perkiraan gagal dimuat, modal tetap dihitung dengan harga hari ini.

## Keamanan

- `src/proxy.ts` membuat **nonce CSP per request** (128-bit) dan memasang header docs 15 §10: HSTS, `nosniff`, Referrer-Policy, Permissions-Policy, COOP, CORP. `X-Powered-By` dimatikan.
- Root layout memakai `instant = false` + `connection()`, sehingga **semua halaman dirender per request**. Shell yang di-prerender tidak membawa nonce, dan browser akan memblokir semua script-nya. Data tetap bisa di-cache dengan `'use cache'` (Cache Components aktif). HTML yang di-cache di edge masih OPEN CSP-01.
- `dangerouslySetInnerHTML` dilarang oleh lint.

## Struktur

```text
src/
├── app/            route: /, /atur-warung, /rencana, /rencana/[menuId], halaman F2–F5, /api/healthz
├── app/bff/        Route Handler BFF → core API
├── components/     shell (header, tab bar bawah, footer, banner DATA DEMO), coming-soon,
│                   mascot (Si Bakul), icons, illustrations (gambar 3 langkah)
├── features/       home · onboarding · planning (layar + komponen domain) · outlook
├── lib/api/        klien server-only ke core API
├── lib/guest-store/ IndexedDB mode tamu
├── lib/planning/   aturan pemilihan harga/perkiraan + nilai tampilan
├── lib/env/        validasi env publik dan server
├── lib/format/     Rp 52.400 · +3,2% · 14 Okt 2026 (id-ID, minus tipografis)
├── lib/security/   CSP + header keamanan
├── proxy.ts        nonce + header per request
└── styles/         Tailwind v4 + token (@kawan-pasar/tokens)
e2e/                smoke (header, CSP nonce) + golden path desktop & HP 360×740 dengan axe
```

## Tampilan dan maskot

Pengguna utama banyak yang berusia lanjut, jadi tampilannya dibuat sederhana: huruf Atkinson Hyperlegible, teks utama 18 px, tombol 48–56 px, dan ikon bergambar dengan label di menu bawah.

**Si Bakul** (`src/components/mascot`) adalah bakul nasi anyaman bambu yang membawa beras, cabai merah keriting, dan bawang merah, yaitu tiga bahan yang dipantau. Ia digambar sebagai SVG inline dengan warna dari token `illustration.*`, tanpa file gambar dan tanpa hex.

| Pose    | Dipakai di                            |
| ------- | ------------------------------------- |
| `wave`  | Beranda publik (menyapa)              |
| `point` | Langkah 1–2 Atur Warung               |
| `happy` | Langkah terakhir Atur Warung, Beranda |
| `think` | Halaman "segera hadir" dan 404        |
| `rest`  | Pose bawaan                           |

**Logo** (`src/components/brand/logo-mark.tsx`) adalah Si Bakul yang disederhanakan: bakul dengan bibir anyaman, senyum, cabai, dan bawang merah, memakai token `illustration.*` yang sama. Nama "Kawan Pasar" di header tetap teks biasa agar terbaca jelas. Favicon (`src/app/icon.svg`, `favicon.ico`) dan `apple-icon.png` memakai potongan yang lebih tebal karena garis anyaman hilang di bawah 48 px. File induk (SVG warna, satu warna, lockup, ikon aplikasi) ada di folder desain proyek, bukan di repo.

Kalimat Si Bakul singkat dan menjelaskan langkah, tidak pernah menyarankan membeli, menjual, atau mengubah menu. Animasinya (berkedip, melambai tiga kali, gelembung muncul) hanya berjalan lewat `motion-safe:`, sehingga berhenti bila perangkat diatur "kurangi gerakan". Test e2e memeriksa hal ini.
