# Kawan Pasar

> Pantau harga pangan harian, lihat prediksi ARIF-Net, dan pahami inflasi pangan.

Kawan Pasar membantu masyarakat dan pelaku usaha kecil membaca harga pangan: berapa harga hari ini di pasar acuan, ke mana arahnya beberapa hari ke depan, dan apa artinya bagi inflasi pangan. Prediksi berasal dari model riset **ARIF-Net**. Produk tetap berguna walaupun prediksi belum tersedia, karena harga harian dan edukasi berdiri sendiri. Maskot **Kapa** (bawang merah) menemani penjelasan tanpa pernah memberi saran membeli atau menjual.

|                   |                                                                                                                    |
| ----------------- | ------------------------------------------------------------------------------------------------------------------ |
| **Status**        | F0 selesai; tampilan v0.4 (harga, prediksi, edukasi) berjalan dengan DATA DEMO. Berikutnya F2: ingest harga harian |
| **Mode data**     | `demo`: semua angka contoh diberi label **DATA DEMO**. Perkiraan masih dalam pengembangan                          |
| **Cakupan harga** | 5 komoditas di Pasar Kramat Jati; 3 diprediksi (cabai merah keriting, bawang merah, beras medium)                  |
| **Lisensi**       | [Apache-2.0](LICENSE)                                                                                              |

Dokumen lanjutan:

- [ARCHITECTURE.md](ARCHITECTURE.md): service, aliran data, keamanan, dan kontrak.
- [CONTRIBUTING.md](CONTRIBUTING.md): cara kerja tim, aturan kode, test, dan PR.

## Fitur saat ini

| Fitur                                                               | Route                      | Status                               |
| ------------------------------------------------------------------- | -------------------------- | ------------------------------------ |
| Beranda: sorotan, harga hari ini, cuplikan prediksi, edukasi        | `/`                        | ✓ (DATA DEMO)                        |
| Harga: tabel 5 komoditas, filter, riwayat 30/90 hari/1 tahun        | `/harga`                   | ✓ (DATA DEMO sampai F2)              |
| Detail komoditas: perubahan 1/7/30/90 hari, grafik, konteks         | `/harga/[slug]`            | ✓                                    |
| Prediksi ARIF-Net: horizon 1 hari–1 tahun, provenance, keterbatasan | `/prediksi`                | ✓ (180 hari & 1 tahun "belum diuji") |
| Edukasi + artikel inflasi pangan                                    | `/edukasi`, `/edukasi/…`   | ✓                                    |
| Kenalan ARIF-Net + keterbatasan                                     | `/arif-net`, `/arif-net/…` | ✓                                    |
| Mode Analis: tabel sinyal + unduh CSV                               | `/analis`, `/analis/unduh` | ✓                                    |
| Pilih pasar                                                         | `/pasar`                   | ✓ (Kramat Jati; pasar lain menyusul) |
| Peringatan harga (WhatsApp/Web Push)                                | `/peringatan`              | Pratinjau; butuh akun (F3)           |

Route lama (`/pantau`, `/outlook`, `/pelajari`, `/konteks`, `/rencana`, `/atur-warung`) dialihkan permanen ke halaman v0.4 terdekat.

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
# → buka http://localhost:3000

pnpm stack:down       # berhenti
```

Untuk mengembangkan web saja, tanpa Docker:

```bash
cp apps/web/.env.example apps/web/.env.local
pnpm --filter @kawan-pasar/web dev            # http://localhost:3000
```

Prediksi membutuhkan api dan model service. Tanpa keduanya, harga tetap tampil dan halaman Prediksi menampilkan "Prediksi gagal dimuat".

## Test

```bash
pnpm run check                                           # lint + typecheck + unit test semua paket
pnpm --filter @kawan-pasar/web exec playwright install chromium   # sekali saja
pnpm --filter @kawan-pasar/web test:e2e                  # jalur utama desktop + HP 360×740, axe
(cd services/model && uv sync && uv run pytest)          # model service
(cd services/ingest && uv sync && uv run pytest)         # ingest
```

CI (`.github/workflows/ci.yml`) menjalankan semua cek ini di setiap PR, dan setiap job hanya berjalan bila path terkait berubah. Image Docker di-scan Trivy lewat `.github/workflows/images.yml`, lalu di-push ke GHCR hanya dari tag `vX.Y.Z`. Pembaruan dependensi diatur Renovate (`.github/renovate.json5`); aplikasi Renovate perlu dipasang di repo.

## Struktur repo

```text
apps/
  web/            Next.js 16: UI v0.4, BFF (/bff/*), unduh CSV
  api/            NestJS 12 (Fastify): core API /v1/*, worker BullMQ
services/
  model/          FastAPI: menyajikan bundle artefak ARIF-Net (internal, HMAC)
  ingest/         Job harian harga PIHPS (Python, uv)
packages/
  domain/         Aturan hitung modal, margin, simulasi, Q95 (belum dipakai web sejak v0.4)
  contracts/      Skema zod kontrak API dan bundle artefak
  catalog/        Komoditas, pasar, bahan, dan template (berversi)
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

Model perkiraan dikembangkan di repo riset [ARIF-Net](https://github.com/ariftsx/ARIF-Net). Pipeline mingguan riset menghasilkan bundle artefak berversi dan berchecksum. Model service hanya menyajikan bundle yang lolos verifikasi. Selama model belum selesai, Prediksi berjalan dalam **mode pengembangan** dengan bundle DATA DEMO, dan tidak ada model pengganti sementara.
