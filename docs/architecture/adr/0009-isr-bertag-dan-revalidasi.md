# ADR 0009 — ISR bertag, revalidasi dari API, dan rute data per pasar

- Status: **Diterima** (12 Nov 2026, Fase 1B)
- Terkait: desain §6.2; ADR 0005, 0007, 0008

## Konteks

1. Halaman publik harus disajikan dari cache. Database dan API hanya disentuh sekali per pembaruan data, bukan sekali per pengunjung.
2. Image `web` dibangun di Docker **tanpa akses ke API**. Halaman data yang diprerender saat build akan gagal, atau menyimpan status galat ke cache.
3. Render dan revalidasi server datang dari satu IP (kontainer `web`) tanpa `X-Forwarded-For`. Dengan rate limit 120/menit per IP, lonjakan revalidasi bisa berbuah 429.

## Keputusan

### Alur data

- Halaman memanggil `api.*` (`apps/web/src/lib/api/endpoints.ts`). Fungsi ini menjalankan `fetch` server-only dengan token layanan, timeout 3 detik, `cache: 'force-cache'`, dan tag (`cacheTags` dari `@kawan-pasar/contracts`).
- Setiap respons divalidasi ulang dengan skema `@kawan-pasar/contracts` (validasi ganda). Respons yang menyimpang dari kontrak dianggap `unavailable`.
- `requireData()` memetakan hasil:

  | Hasil         | Tindakan                            |
  | ------------- | ----------------------------------- |
  | Data          | Data diberikan ke halaman           |
  | `not_found`   | `notFound()` (halaman 404)          |
  | `unavailable` | Melempar `UpstreamUnavailableError` |

- Galat yang dilempar **tidak pernah di-cache ISR**:
  - Bila sudah ada versi baik, versi itu tetap disajikan.
  - Bila belum ada, pengunjung melihat status "Gagal memuat" (500, `no-store`). Permintaan berikutnya mencoba lagi.
- Revalidasi cadangan (detik): harga/prediksi 600, artikel 21.600, pasar 86.400.

### Rute data di bawah `[market]`

- Halaman data berada di `app/[market]/…` dengan `generateStaticParams()` kosong, sehingga tidak ada yang dirender saat build. Halaman dirender pada permintaan pertama, lalu di-cache (ISR on-demand).
- URL publik tetap tanpa kode pasar lewat `rewrites` (`/pasar` → `/PIKJ/pasar`).
- `src/proxy.ts` menolak segmen pasar yang tidak dikenal dengan 404 sebelum render. Tanpa penjaga ini, setiap path acak akan membuat entri cache baru.

**Pembaruan Fase 1C.**

- **Rute data:** `beranda`, `harga`, `harga/[commodity]`, `prediksi`, `prediksi/[commodity]`, `edukasi`, `edukasi/[slug]`, `pasar`. Daftar rewrite dibangkitkan dari `src/lib/routes.ts`. `proxy.test.ts` memastikan setiap tujuan rewrite tercakup `matcher` (literal).
- **Penolakan `proxy.ts`:** pasar, kode komoditas, atau slug yang tidak lolos `ArticleSlugSchema` ditolak, demikian juga segmen tambahan. Semuanya di-rewrite ke path tanpa rute (`/_kp/tidak-ditemukan`), sehingga pengunjung melihat halaman not-found statis dengan status 404 dan `no-store`.
- **Slug artikel:** halaman artikel mencocokkan slug dengan daftar artikel terbit (yang sudah di-cache) sebelum memanggil API, sehingga slug tak dikenal tidak pernah sampai ke API.
- **Risiko sisa:** slug yang sah secara bentuk tetapi tidak ada tetap dirender sebagai 404 sekali per path. Batasnya tmpfs `route-cache` 128 MB dan rate limit Traefik.
- **`/` (orientasi):** `proxy.ts` mengalihkan pengunjung yang punya cookie `kp_onboarded=1` ke `/beranda`. Cookie dipasang `MarkOnboarded` di halaman lain; tidak mengidentifikasi pengguna.

### Revalidasi bertag

1. Data berubah: ingest atau `POST /internal/cache/invalidate`, termasuk yang dipicu CLI bundel lewat `notifyApiInvalidate`.
2. API menghapus cache Valkey, lalu `WebRevalidator` memanggil `POST http://web:3000/api/internal/revalidate`:
   - Header `x-revalidate-token` memakai rahasia yang berbeda dari token layanan.
   - Tag dibatasi lewat whitelist, maksimal 50 per permintaan.
3. Web menjalankan `revalidateTag(tag, 'max')` (stale-while-revalidate). Pengunjung berikutnya menerima versi lama sekali sementara versi baru dibangun di latar, jadi tidak ada lonjakan render.
4. Traefik memblokir `/api/internal/*` dari luar (`block-internal` → `noop@internal`, 418).
5. Revalidasi bersifat best effort. Bila web tidak menjawab, API mencatat peringatan terbatas dan TTL cadangan membatasi umur data basi.

### Ember rate limit internal

Permintaan dari proxy tepercaya **tanpa** `X-Forwarded-For` (render server) memakai ember `internal` (`RATE_LIMIT_INTERNAL_PER_MINUTE`, default 1200). Permintaan yang meneruskan IP pengunjung tetap dibatasi per IP (120/menit). Klien yang bukan proxy tepercaya tidak pernah masuk ember `internal`, karena yang menentukan adalah alamat socket, bukan header. Lihat juga ADR 0005.

### Kontainer

- `web` berjalan `read_only` sebagai `node`. Yang bisa ditulis hanya dua tmpfs berukuran terbatas:
  - `.next/cache`: 256 MB, cache data fetch.
  - `.next/server/route-cache`: 128 MB, HTML/RSC hasil ISR. Kebutuhan ini ditemukan saat uji, karena tanpa tmpfs ini Next gagal menulis cache halaman di filesystem read-only.
- Kompresi dimatikan di Next (`compress: false`) dan dikerjakan sekali di Traefik (brotli).

## Opsi yang dipertimbangkan

| Opsi                                      | Mengapa tidak                                                                                         |
| ----------------------------------------- | ----------------------------------------------------------------------------------------------------- |
| Build image dengan API berjalan           | Build bergantung pada tumpukan yang hidup; tidak bisa di CI/produksi                                  |
| Halaman data `force-dynamic`              | Render per pengunjung; melawan tujuan tahan beban (alasan yang sama dengan penolakan nonce, ADR 0008) |
| Render status galat dan biarkan di-cache  | Pengunjung melihat "gagal" sampai revalidasi berikutnya walaupun API sudah pulih                      |
| Cache Components (`cacheComponents`, PPR) | Masih merender bagian dinamis per permintaan; menambah kompleksitas tanpa kebutuhan di Fase 1         |

## Konsekuensi

- Pengunjung pertama setelah deploy atau restart menunggu satu render. Pengunjung berikutnya dilayani dari cache. Dari uji: 200 MISS lalu 200 HIT.
- Cache ISR tersimpan **per kontainer** dan hilang saat kontainer restart (tmpfs). Fase 1 memakai satu replika `web`. Untuk lebih dari satu replika, ada dua jalan: fan-out revalidasi ke setiap replika, atau cache handler bersama di Valkey. Keputusannya diambil di Fase 1D bersama uji beban.
- Setiap rute data baru di bawah `[market]` wajib ditambahkan ke `rewrites` dan `proxy.ts` `matcher`.
- Nama tag adalah kontrak, dan hanya ada satu sumber: `cacheTags` dan `parseCacheTag` di `@kawan-pasar/contracts`. API memakainya untuk membangun daftar tag, web memakainya untuk memberi tag pada fetch dan menyaring tag yang masuk. Uji API memastikan setiap tag yang dikirim lolos `parseCacheTag`.
