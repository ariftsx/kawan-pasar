# Audit Fase 1B — Fondasi Web

- Tanggal: 12 November 2026
- Rencana: [`docs/plans/2026-11-12-fase-1b-fondasi-web.md`](../plans/2026-11-12-fase-1b-fondasi-web.md)
- Status: **Lulus. Menunggu tinjauan dan commit pemilik sebelum Fase 1C.**

## 1. Yang dihasilkan

| Area          | Hasil                                                                                                                                                                      |
| ------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Token         | `@kawan-pasar/tokens`: palet v0.4, 16 gaya tipe, spasi/radius/breakpoint/gerak, dan `@theme` Tailwind 4 dari satu sumber. Kontras AA diuji (`docs/design-system/token.md`) |
| Web           | Next.js 16.4.6 + React 19.3.1 + Tailwind 4.3.5; font self-host (48 KB total); env tervalidasi; CSP hibrida (ADR 0008)                                                      |
| Brand         | Logo, 5 ikon komoditas, 19 ikon fitur, 4 ilustrasi, dan Kapa 7 pose dengan animasi CSS                                                                                     |
| Komponen      | 11 atom, 10 molekul, 7 organisme, 3 template; 5 status sistem; kerangka responsif desktop/mobile                                                                           |
| Data          | Klien API server-only dengan validasi ganda, cache bertag, dan galat yang tidak di-cache; rute `[market]` + rewrites + `proxy.ts`; `/pasar` sebagai halaman data pertama   |
| Revalidasi    | API → `POST /api/internal/revalidate` (token tersendiri; tag dari `cacheTags` bersama), dipicu invalidasi cache dan CLI bundel (ADR 0009)                                  |
| API           | Ember rate limit `internal` (1200/menit) untuk render server web; `WebRevalidator`; `notifyApiInvalidate`                                                                  |
| Infrastruktur | Kontainer `web` (172.30.0.10, non-root, read-only, `cap_drop: ALL`, tmpfs terbatas); router Traefik + blokir `/api/internal/*`; brotli di Traefik                          |
| Uji           | e2e Playwright + axe (`tests/e2e`); 3 gerbang audit baru (`web-build`, `stack-rebuild`, `e2e-smoke`); `infra-check` +7 pemeriksaan                                         |

## 2. Gerbang mutu (`pnpm audit:all`, run final setelah perbaikan)

**16/16 lulus**: format, lint, typecheck, unit, web-build (tanpa API dan tanpa `.env`), stack-rebuild, infra (22 pemeriksaan), integrasi, e2e-smoke, reset DB uji, ingest pytest, mypy, ruff, audit dependensi (0 kerentanan), pemindaian `any`, dan pemindaian atribusi AI.

| Paket           | Uji                                                           |
| --------------- | ------------------------------------------------------------- |
| tokens          | 33 unit                                                       |
| contracts       | 14 unit                                                       |
| catalog         | 7 unit                                                        |
| web             | 95 unit (komponen, brand, klien API, route revalidasi, proxy) |
| api             | 63 unit + 98 integrasi                                        |
| e2e             | 39 skenario (Chromium, lewat Traefik)                         |
| ingest (Python) | 54 uji, cakupan 96,9%                                         |

## 3. Simulasi pengguna akhir dan pengukuran

| Pemeriksaan                          | Hasil                                                                                                           |
| ------------------------------------ | --------------------------------------------------------------------------------------------------------------- |
| Lebar 320/360/390/768/1024/1280/1440 | Tanpa scroll horizontal; NavBar ≥ 1024, TopBar + TabBar di bawahnya; TabBar tidak menutupi konten               |
| Teks 200% (360 dan 1024 px)          | Tanpa scroll horizontal (setelah perbaikan §4)                                                                  |
| axe WCAG 2.2 AA (360, 1280 px)       | 0 pelanggaran                                                                                                   |
| Keyboard                             | Tab pertama = "Lewati ke konten"; outline fokus terlihat                                                        |
| JS awal terkompresi                  | ≈ 136 KB per rute (anggaran 170 KB); HTML ≈ 7 KB                                                                |
| Konsol browser                       | Tanpa pelanggaran CSP dan tanpa galat hidrasi                                                                   |
| `next build` tanpa API               | Lulus; `/[market]/pasar` tidak diprerender                                                                      |
| ISR                                  | `/pasar`: MISS → HIT; revalidasi dari API → STALE → HIT; web mencatat `revalidated tags=30`                     |
| API mati, cache sudah ada            | Halaman tetap 200 dari cache                                                                                    |
| API mati, cache kosong               | 500 `no-store` dengan status "Gagal memuat" + "Coba lagi"; tanpa detail internal; pulih otomatis saat API hidup |
| Pasar tak dikenal (`/ZZZZ/pasar`)    | 404 `no-store` dari `proxy.ts` tanpa render dan tanpa entri cache                                               |
| `/api/internal/revalidate` dari luar | Ditolak Traefik (418) untuk semua variasi path yang dicoba peninjau                                             |
| Pemeriksaan visual (390 dan 1280 px) | Sesuai tata letak v0.4; Kapa bergerak saat terlihat dan diam di `prefers-reduced-motion`                        |

## 4. Temuan selama pelaksanaan (diperbaiki)

| #   | Temuan                                                                                                | Perbaikan                                                                        |
| --- | ----------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------- |
| 1   | `script-src 'self'` memblokir payload RSC inline (spike Task 2)                                       | `'unsafe-inline'` hanya di `script-src`, sesuai cadangan opsi hibrida (ADR 0008) |
| 2   | SRI Next hanya menutup sebagian chunk (Turbopack dan webpack sama)                                    | Didokumentasikan; pengendali utama tetap `'self'` tanpa origin luar              |
| 3   | Next menulis cache halaman ISR ke `.next/server/route-cache`; di filesystem read-only hal ini gagal   | tmpfs 128 MB khusus untuk folder itu                                             |
| 4   | Next mengompres gzip sendiri, sehingga brotli Traefik tidak pernah terpakai                           | `compress: false` di Next                                                        |
| 5   | Path `/<acak>/pasar` dirender dan 404-nya di-cache, sehingga cache bisa dibanjiri                     | `proxy.ts` menolak kode pasar tak dikenal sebelum render                         |
| 6   | `PageContainer`: `mx-auto` di dalam flex-col membuat konten menyempit; footer tidak menempel di dasar | Struktur kontainer dan `body` flex                                               |
| 7   | axe: nama `MarketPicker` tidak memuat teks yang terlihat (WCAG 2.5.3)                                 | Teks tersembunyi menggantikan `aria-label`                                       |
| 8   | Cache `tsx` (`apps/api/undefined/…`) ikut ter-commit sejak Fase 0                                     | Dihapus + `.gitignore`; isinya kode sumber tanpa rahasia (dicek)                 |
| 9   | `.prettierignore` `data/` tanpa jangkar: semua folder `data` di mana pun tidak pernah diformat        | `/data/`; empat dokumen `docs/data/*` ikut diformat                              |
| 10  | Nama tag cache didefinisikan dua kali (API dan web)                                                   | Satu sumber: `cacheTags`/`parseCacheTag` di `@kawan-pasar/contracts`             |
| 11  | Traefik tidak membaca ulang `routes.yml` (Docker Desktop di Windows tidak meneruskan event berkas)    | Dicatat di troubleshooting (`restart traefik`)                                   |

## 5. Tinjauan independen

Hasil: **0 kritis, 5 penting.** Kelimanya diperbaiki dengan uji RED → GREEN, ditambah 6 minor yang murah tetapi berdampak nyata.

| Temuan                                                                                                                                  | Perbaikan                                                                                                    |
| --------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------ |
| "Coba lagi" di error boundary hanya memanggil `reset()`, sehingga tetap gagal walau API sudah pulih                                     | `router.refresh()` + `reset()` dalam `startTransition` (uji `error.test.tsx`)                                |
| TabBar terpotong di 320 px dan di teks 200% ("Edukasi"/"Lainnya" tak terjangkau)                                                        | Grid 5 kolom sama lebar, label dengan elipsis                                                                |
| `/pasar` dan NavBar desktop meluap di teks 200%                                                                                         | `min-w-0`/`minmax(0,1fr)`; NavBar boleh membungkus                                                           |
| Uji e2e luapan bisa lulus tanpa menguji apa pun (`innerWidth` termasuk scrollbar; elemen `fixed` tak terhitung; teks 200% hanya di `/`) | Pakai `clientWidth` + tepi setiap elemen; 200% dan 320 px untuk semua halaman (9 uji gagal dulu, lalu lulus) |
| Kapa berulang tanpa henti (WCAG 2.2.2, level A)                                                                                         | Satu siklus 3,2 detik setiap kali masuk layar (uji membuktikan `infinite` gagal)                             |
| _(minor)_ Ember `internal` gagal mengenali alamat IPv4-mapped (`::ffff:`) bila API mendengar di `::`                                    | Normalisasi alamat socket (uji unit)                                                                         |
| _(minor)_ Nama `HorizonPill` ("7 hari") tidak memuat label yang terlihat ("7H")                                                         | Label tampil + teks tersembunyi                                                                              |
| _(minor)_ Kelas tinggi sparkline bertabrakan di baris mobile                                                                            | Tinggi lewat `style`                                                                                         |
| _(minor)_ `gen-env --add-missing` menganggap nilai kosong sudah ada dan bisa menempel ke baris terakhir                                 | Nilai kosong dianggap hilang; baris baru dijamin                                                             |
| _(minor)_ CLI bundel melapor "API tidak terjangkau" saat web lambat (timeout 3 s sama dengan timeout API ke web)                        | Timeout CLI 8 s                                                                                              |
| _(minor)_ Kontainer Node tanpa `cap_drop`                                                                                               | `cap_drop: [ALL]` untuk `api` dan `web`                                                                      |

**Minor yang ditunda** (untuk fase berikutnya):

1. Route revalidasi membaca seluruh body sebelum memeriksa 8 KiB. Hanya terjadi setelah token valid, dan path diblokir Traefik.
2. Pasar tak dikenal mendapat 404 kosong, bukan halaman not-found yang ramah.
3. Respons 200 yang melanggar kontrak tetap tersimpan di cache data Next sampai revalidasi berikutnya.
4. Halaman yang di-cache saat data masih segar tidak berubah menjadi "Terlambat" selama API mati. **Fase 1C:** hitung status keterlambatan saat render atau beri label tanggal. Catatan untuk CDN produksi: header `s-maxage` Next mengabaikan revalidasi tag.
5. `mem_limit`/`pids_limit` belum ada di semua layanan. `web` bergantung pada `api` sehat untuk start, padahal ia bisa melayani halaman statis tanpa API.
6. Env web baru divalidasi saat render data pertama; `/api/health` tetap sehat walau env salah. Validasi saat startup lewat `instrumentation.ts`.
7. Timeout klien ingest (3 s) sama dengan timeout API ke web (sama seperti CLI bundel sebelum perbaikan).

## 6. Keputusan pelaksanaan (rulings)

| Ruling                                                               | Alasan                                                                               | Biaya bila salah                                                              |
| -------------------------------------------------------------------- | ------------------------------------------------------------------------------------ | ----------------------------------------------------------------------------- |
| `'unsafe-inline'` di `script-src`                                    | Payload RSC inline tidak bisa di-hash untuk halaman statis (cadangan yang disetujui) | XSS inline tidak diblokir CSP; mitigasi di ADR 0008                           |
| Rute data di `/[market]/…` + rewrites                                | Build tanpa API, tanpa render per pengunjung                                         | Setiap rute data baru wajib ditambah ke rewrites + `matcher`                  |
| Galat upstream dilempar, bukan dirender sebagai status               | ISR tidak pernah menyimpan halaman galat                                             | Pengunjung tanpa cache mendapat 500 (dengan UI ramah)                         |
| `revalidateTag(tag, 'max')`                                          | Mencegah lonjakan render setelah pembaruan                                           | Satu pengunjung melihat versi lama sekali                                     |
| Kapa satu siklus per masuk layar (prototipe: terus-menerus)          | WCAG 2.2.2 level A                                                                   | Maskot terasa kurang "hidup"; mudah diubah menjadi pemutaran ulang saat hover |
| 3 token warna teks tambahan (`muted-text`, `green-700`, `chili-700`) | Warna v0.4 gagal AA untuk teks kecil                                                 | Sedikit berbeda dari prototipe                                                |
| Halaman sementara "Sedang disiapkan" untuk rute navigasi             | `typedRoutes` dan uji e2e butuh rute nyata                                           | Diganti di 1C                                                                 |
| Konfigurasi ESLint React di `apps/web` (bukan di paket bersama)      | Hanya satu workspace React; menghindari dependensi plugin di paket bersama           | Dipindah bila ada workspace React kedua                                       |
| Satu berkas `OFL.txt` untuk kedua font (rencana: dua berkas)         | Lisensi sama; kedua copyright tercantum                                              | —                                                                             |

## 7. Catatan untuk pemilik

1. Jalankan `node scripts/gen-env.mjs --add-missing` di mesin lain yang `.env`-nya dibuat sebelum Fase 1B (rahasia baru: `WEB_REVALIDATE_TOKEN`).
2. Situs lokal: **http://127.0.0.1:8080**.
3. Berkas `apps/api/undefined/…` tampil sebagai "deleted" di `git status`. Ini memang dihapus (lihat §4 #8).
4. Semua perubahan belum di-commit; usulan urutan commit diberikan terpisah.
