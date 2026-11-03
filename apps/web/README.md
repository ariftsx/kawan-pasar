# @kawan-pasar/web

Aplikasi web Kawan Pasar: UI, BFF, dan PWA di Next.js 16 (docs 12). Berisi tampilan **v0.4**: Beranda, Harga, Detail komoditas, Prediksi ARIF-Net, Peringatan (pratinjau), Edukasi, ARIF-Net, Keterbatasan, Mode Analis, dan Pilih Pasar. Tanpa login.

## Menjalankan

```bash
cp .env.example .env.local
pnpm --filter @kawan-pasar/web dev        # http://localhost:3000
pnpm --filter @kawan-pasar/web build
pnpm --filter @kawan-pasar/web test       # Vitest (src/lib)
pnpm --filter @kawan-pasar/web exec playwright install chromium   # sekali
pnpm --filter @kawan-pasar/web test:e2e   # Playwright: smoke + jalur utama (butuh build)
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

## Alur data

```text
packages/catalog (komoditas, pasar) ─► lib/market/board.ts ─► Beranda · Harga · Detail · Analis
NEXT_PUBLIC_DATA_MODE (demo | live) ─┘     (demo: seri contoh DATA DEMO; live: null sampai F2)
/v1/outlook/:slug ─► lib/outlook/server.ts ─► lib/outlook/schema.ts ─► Prediksi · Detail · Beranda
```

- `lib/market/demo-series.ts`: seri harga contoh yang deterministik (seed per komoditas). Titik terakhir sama dengan harga demo katalog. Selalu berlabel DATA DEMO.
- `lib/market/board.ts`: perubahan 7/30 hari, urutan pergerakan terbesar, sorotan, dan CSV Mode Analis. Nilai tidak diketahui tetap `null` (tampil "—").
- `lib/outlook/schema.ts`: parse respons outlook. Prediksi tanpa provenance lengkap tidak pernah ditampilkan; horizon 180 hari dan 1 tahun disembunyikan sebagai "belum diuji".
- Bila prediksi gagal dimuat, harga tetap tampil dan halaman menyebut kode request.

## Keamanan

- `src/proxy.ts` membuat **nonce CSP per request** (128-bit) dan memasang header docs 15 §10: HSTS, `nosniff`, Referrer-Policy, Permissions-Policy, COOP, CORP. `X-Powered-By` dimatikan.
- Root layout memakai `instant = false` + `connection()`, sehingga **semua halaman dirender per request**. Shell yang di-prerender tidak membawa nonce, dan browser akan memblokir semua script-nya. Data tetap bisa di-cache dengan `'use cache'` (Cache Components aktif). HTML yang di-cache di edge masih OPEN CSP-01.
- `dangerouslySetInnerHTML` dilarang oleh lint.

## Struktur

```text
src/
├── app/            /, /harga, /harga/[slug], /prediksi, /peringatan, /edukasi(/inflasi-pangan),
│                   /arif-net(/keterbatasan), /analis(+/unduh CSV), /pasar, /lainnya, /api/healthz
├── app/bff/        Route Handler BFF → core API
├── components/
│   ├── brand/      logo, maskot Kapa (7 pose), ikon komoditas, ikon fitur, ilustrasi
│   ├── kp/         blok layar v0.4: chip status, Kata Kapa, grafik harga, sparkline, kartu komoditas
│   └── shell/      header, tab bar bawah, footer, banner DATA DEMO
├── lib/api/        klien server-only ke core API
├── lib/market/     papan harga, seri DATA DEMO, helper route
├── lib/outlook/    parse outlook + status horizon
├── lib/env/        validasi env publik dan server
├── lib/format/     Rp 52.400 · ↑ +3,2% · 18 Okt 2026 (id-ID, minus tipografis)
├── lib/security/   CSP + header keamanan
├── proxy.ts        nonce + header per request
└── styles/         Tailwind v4 + token (@kawan-pasar/tokens)
e2e/                smoke (header, CSP nonce, redirect, CSV) + jalur utama desktop & HP 360×740 dengan axe
```

## Tampilan dan maskot

Tampilan mengikuti prototipe v0.4: huruf Plus Jakarta Sans untuk teks dan Geist Mono untuk harga dan persen, teks utama 18 px, target sentuh minimal 44 px, dan arah harga selalu ditulis dengan panah dan tanda (↑ +3,2%), tidak hanya warna. Warna prediksi ungu, sorotan kunyit, dan permukaan merek hijau tua; semuanya dari token, tanpa hex.

**Kapa** (`src/components/brand/kapa.tsx`) adalah maskot bawang merah. Ia digambar sebagai SVG inline dengan token `illustration.*`.

| Pose        | Dipakai di                                   |
| ----------- | -------------------------------------------- |
| `halo`      | Hero Beranda (bergerak pelan bila diizinkan) |
| `menunjuk`  | ARIF-Net                                     |
| `prediksi`  | Prediksi                                     |
| `belajar`   | Edukasi, Detail, 404                         |
| `waspada`   | Harga, Keterbatasan                          |
| `senang`    | Kata Kapa umum                               |
| `istirahat` | Keadaan kosong (Peringatan)                  |

**Kata Kapa** menjelaskan cara membaca angka, tidak pernah menyarankan membeli, menjual, atau menimbun, dan tidak menyebut penyebab perubahan harga. Animasi (mengangguk dan berkedip) hanya berjalan bila perangkat tidak meminta "kurangi gerakan"; test e2e memeriksanya.

**Logo** (`src/components/brand/logo-mark.tsx`): keranjang pasar di bawah garis harga yang naik dan berakhir di titik prediksi, di atas ubin hijau tua. Favicon (`src/app/icon.svg`, `favicon.ico`) dan `apple-icon.png` dibuat dari bentuk yang sama.
