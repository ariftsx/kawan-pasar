# Kawan Pasar

> Perencana modal menu dan risiko harga bahan pangan untuk warung dan UMKM kuliner.

Kawan Pasar membantu pemilik warung menjawab satu pertanyaan: _"Berapa modal per porsi menu saya hari ini, dan minggu depan?"_ Perkiraan harga berasal dari model riset **ARIF-Net**, yang menjadi fitur unggulan **Outlook Harga ★**, bukan seluruh produk. Produk tetap berguna walaupun model belum tersedia.

|                   |                                                                                                                       |
| ----------------- | --------------------------------------------------------------------------------------------------------------------- |
| **Status**        | F0 (fondasi) dan F1 (golden path mode tamu) selesai. Berikutnya F2: harga harian (menunggu perbaikan collector PIHPS) |
| **Mode data**     | `demo`: semua angka contoh diberi label **DATA DEMO**. Perkiraan masih dalam pengembangan                             |
| **Cakupan harga** | 3 komoditas model di Pasar Kramatjati: cabai merah keriting, bawang merah, beras medium                               |
| **Lisensi**       | [Apache-2.0](LICENSE)                                                                                                 |

Dokumen lanjutan:

- [ARCHITECTURE.md](ARCHITECTURE.md): service, aliran data, keamanan, dan kontrak.
- [CONTRIBUTING.md](CONTRIBUTING.md): cara kerja tim, aturan kode, test, dan PR.

## Fitur saat ini

| Fitur                                                                           | Route               | Status                           |
| ------------------------------------------------------------------------------- | ------------------- | -------------------------------- |
| Beranda publik + contoh perhitungan                                             | `/`                 | ✓                                |
| Atur Warung (jenis warung → menu & porsi → peringatan)                          | `/atur-warung`      | ✓ tanpa login, data di perangkat |
| Beranda pribadi (modal hari ini, perkiraan 7 hari, bahan yang perlu diwaspadai) | `/`                 | ✓                                |
| Rencana Menu (total per hari, asal modal, tabel menu, simulasi, ekspor JSON)    | `/rencana`          | ✓                                |
| Rincian Menu (bahan per porsi, margin, ubah resep, hapus)                       | `/rencana/[menuId]` | ✓                                |
| Pantau Harga · Outlook ★ · Konteks · Pelajari                                   | `/pantau` dst.      | Halaman "segera hadir" (F2–F5)   |
| Masuk dengan Google, peringatan, Web Push                                       | —                   | F3                               |

## Mulai cepat

Prasyarat:

- **Node.js 24** (lihat `.nvmrc`) dan **pnpm 12** (`npm i -g pnpm@12.14.0`)
- **Docker Desktop** untuk stack lokal
- Opsional, untuk service Python: **Python 3.14** dan **[uv](https://docs.astral.sh/uv/) ≥ 0.13**

```bash
git clone https://github.com/ariftsx/kawan-pasar.git && cd kawan-pasar
pnpm install          # dependensi + git hooks (lefthook)

# Jalankan semuanya di Docker: web, api, worker, model, Postgres, Valkey
pnpm stack:env        # sekali: membuat infra/.env berisi secret lokal acak
pnpm stack:up         # build + start, menunggu semua health check
# → buka http://localhost:3000, lalu pilih "Atur warung"

pnpm stack:down       # berhenti
```

Untuk mengembangkan web saja, tanpa Docker:

```bash
cp apps/web/.env.example apps/web/.env.local
pnpm --filter @kawan-pasar/web dev            # http://localhost:3000
```

Perkiraan 7 hari membutuhkan api dan model service. Tanpa keduanya, aplikasi tetap menghitung modal dengan harga hari ini dan menampilkan "Perkiraan belum tersedia".

## Test

```bash
pnpm run check                                           # lint + typecheck + unit test semua paket
pnpm --filter @kawan-pasar/web exec playwright install chromium   # sekali saja
pnpm --filter @kawan-pasar/web test:e2e                  # golden path desktop + HP 360×740, axe
(cd services/model && uv sync && uv run pytest)          # model service
(cd services/ingest && uv sync && uv run pytest)         # ingest
```

CI (`.github/workflows/ci.yml`) menjalankan semua cek ini di setiap PR, dan setiap job hanya berjalan bila path terkait berubah. Image Docker di-scan Trivy lewat `.github/workflows/images.yml`, lalu di-push ke GHCR hanya dari tag `vX.Y.Z`. Pembaruan dependensi diatur Renovate (`.github/renovate.json5`); aplikasi Renovate perlu dipasang di repo.

## Struktur repo

```text
apps/
  web/            Next.js 16: UI, BFF (/bff/*), mode tamu (IndexedDB)
  api/            NestJS 12 (Fastify): core API /v1/*, worker BullMQ
services/
  model/          FastAPI: menyajikan bundle artefak ARIF-Net (internal, HMAC)
  ingest/         Job harian harga PIHPS (Python, uv)
packages/
  domain/         Aturan hitung modal, margin, simulasi, Q95 (TypeScript murni)
  contracts/      Skema zod kontrak API dan bundle artefak
  catalog/        Bahan, jenis warung, template menu (berversi)
  ui/             Komponen design system "Kawan" (react-aria-components)
  tokens/         Design tokens (DTCG) → CSS variables + tema Tailwind
  config/         Konfigurasi bersama TypeScript, ESLint, Prettier, Vitest
infra/            Stack Docker lokal, Dockerfile, skrip
.github/          CI, scan image, Renovate
```

Setiap paket dan service punya README sendiri yang menjelaskan tujuan, cara menjalankan, env, dan test.

## Dokumentasi produk

Spesifikasi lengkap (brief, PRD, arsitektur, kontrak data, UI/UX, keamanan, infrastruktur, decision register, dan rencana implementasi per fase) disimpan di folder `docs/` pada working copy pemilik produk. Folder ini **belum dipublikasikan** di repo (keputusan D-14). Hubungi pemilik produk untuk akses. Ringkasan yang dibutuhkan untuk mengembangkan kode ada di [ARCHITECTURE.md](ARCHITECTURE.md) dan [CONTRIBUTING.md](CONTRIBUTING.md).

## Hubungan dengan ARIF-Net

Model perkiraan dikembangkan di repo riset [ARIF-Net](https://github.com/ariftsx/ARIF-Net). Pipeline mingguan riset menghasilkan bundle artefak berversi dan berchecksum. Model service hanya menyajikan bundle yang lolos verifikasi. Selama model belum selesai, Outlook berjalan dalam **mode pengembangan** dengan bundle DATA DEMO, dan tidak ada model pengganti sementara.
