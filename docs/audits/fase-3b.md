# Audit Fase 3B — Admin

- Tanggal: 23 November 2026
- Rencana: [`docs/plans/2026-11-23-fase-3b-admin.md`](../plans/2026-11-23-fase-3b-admin.md) (K1, K2 diputuskan pemilik)
- ADR baru: [0014 — Halaman admin tanpa 2FA](../architecture/adr/0014-admin-tanpa-2fa.md)
- Status: **20/20 gerbang lulus** (§ 2: audit pertama gagal di 4 gerbang, semua diperbaiki)

## 1. Yang dihasilkan

| Bagian            | Hasil                                                                                                                                                                                                               |
| ----------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Admin dari server | `admin:grant` / `admin:revoke` (kunci baris, audit; pengajuan menunggu ditutup sebagai disetujui). Web tidak pernah memberi atau mencabut admin                                                                     |
| Penjaga dan sesi  | `AdminGuard`: peran dari DB tiap permintaan; sesi admin mutlak 12 jam, diam 2 jam; konfirmasi sandi 10 menit untuk setiap perubahan (`reauth_required`), dihitung ke lockout. Email "masuk baru" tiap admin masuk   |
| Pengajuan         | Daftar menunggu (email tersamar), setujui/tolak dengan catatan dalam satu transaksi berkunci; kabar `role_decision` + email ke pengaju                                                                              |
| Pengguna          | Cari dengan email persis (POST, tidak di URL/log), cabut peran Analis (bukan diri sendiri/admin)                                                                                                                    |
| Pemantauan        | 20 impor harga, 20 bundel (dengan alasan ditolak, kolom baru `reject_reasons`), jumlah job per antrean tanpa isi                                                                                                    |
| Artikel           | Editor Markdown + pratinjau dengan perender publik, revisi + pulihkan, simpan dengan nomor revisi (409 bila basi), terbit/tarik langsung tampil/hilang di Edukasi. Validasi dengan parser yang sama dengan perender |
| K1                | Seed artikel yang menimpa diganti `articles:import` (sekali, ke DB kosong)                                                                                                                                          |
| K2                | Gambar artikel dari `ARTICLE_IMAGE_ORIGINS` (bawaan Wikimedia + Unsplash; domain tim ditambahkan pemilik): validasi API, perender web (tanpa referrer, lazy), CSP `img-src` statis (build arg) dan per permintaan   |

## 2. Gerbang mutu (`COMPOSE_PARALLEL_LIMIT=1 pnpm audit:all`)

| Gerbang                                                                                                                                                                         | Hasil                                                                                                                                                                                                                                                                                                                              |
| ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Semua 20 (format, lint, typecheck, unit, web-build, stack-rebuild, infra, integrasi, e2e 317, Lighthouse 8 halaman, ingest, model, dependency-audit, no-any, no-ai-attribution) | ✔ pada audit kedua                                                                                                                                                                                                                                                                                                                 |
| Audit pertama                                                                                                                                                                   | 4 gagal, semuanya diperbaiki: **format** (3 berkas), **unit-tests** (berkas uji sempat rusak saat disunting), **lint** (2 temuan di kontrak yang belum dilint: `switch` tidak lengkap, nilai awal tidak terpakai), **infra** (cek "revalidasi → basi" memakai `/edukasi`, yang kini sengaja dikedaluwarsakan seketika; lihat 3B-8) |
| Lighthouse                                                                                                                                                                      | Semua dalam anggaran. `/edukasi/…` LCP 1,87 s pada audit karena cek infra baru saja mengedaluwarsakan cache artikel (render pertama); diukur ulang: 1,27 s                                                                                                                                                                         |

| Paket     | Uji                                                                                                                                                                                                                                                                                                        |
| --------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| api       | 341 (103 unit + 238 integrasi) (unit + integrasi). Baru: CLI admin, penjaga + sesi + konfirmasi + lockout, pengajuan (setujui/tolak/basi/peran berubah), pengguna, pemantauan tanpa isi job, artikel (validasi, revisi basi, terbit/tarik, pulihkan + validasi ulang, hak DB), email masuk admin, template |
| web       | 234 + 2 integrasi unit (baru: CSP asal gambar, perender gambar, proxy `/admin`, revalidasi artikel seketika)                                                                                                                                                                                               |
| contracts | 56 (baru: validator Markdown termasuk definisi ganda, asal gambar, email tersamar, keputusan)                                                                                                                                                                                                              |
| e2e       | `admin.spec.ts` 4 perjalanan: bukan admin → 404, putusan dengan sandi di formulir (360/1280 + axe), tulis → tolak tautan tak aman → simpan → pratinjau → terbit → tampil di Edukasi → tarik → 404                                                                                                          |
| infra     | + cek baru: revalidasi artikel di web-1 membuat web-2 merender baru (bukan basi)                                                                                                                                                                                                                           |

## 3. Simulasi pengguna akhir

| Pengguna   | Perjalanan                                                                                                                                                   | Hasil                                   |
| ---------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------ | --------------------------------------- |
| Pengunjung | `/admin` → diarahkan ke masuk                                                                                                                                | ✔ (e2e)                                 |
| Analis     | `/admin` → 404; tidak ada tombol "Buka Admin" di `/akun`                                                                                                     | ✔ (e2e)                                 |
| Admin      | `/akun` → Buka Admin → setujui pengajuan dengan sandi di formulir → status "Perubahan tanpa kata sandi sampai …"                                             | ✔ (e2e)                                 |
| Admin      | Artikel baru dengan tautan `javascript:` → ditolak dengan alasan, isian tetap → perbaiki → pratinjau → terbitkan → tampil di `/edukasi/<slug>` → tarik → 404 | ✔ (e2e)                                 |
| Admin      | Cari pengguna dengan email lengkap → cabut Analis → unduhan CSV berikutnya ditolak                                                                           | ✔ (uji integrasi API)                   |
| Admin      | Diam 2 jam / 12 jam sejak masuk → harus masuk lagi                                                                                                           | ✔ (uji integrasi API dengan jam tiruan) |

## 4. Tinjauan independen (baca-saja)

- **High:** tidak ada.
- **Medium (1, diperbaiki dengan uji yang gagal dulu):** definisi tautan Markdown ganda. Validator memakai definisi terakhir, sedangkan perender (dan CommonMark) memakai yang pertama, sehingga `[x]: //evil` bisa bersembunyi di balik `[x]: https://ok`. Kini definisi pertama yang diperiksa.
- **Low, diperbaiki:** memulihkan revisi lama kini divalidasi ulang dengan aturan hari ini (revisi dari impor atau sebelum asal gambar diubah).
- **Low, diterima dan dicatat:**
  - terbit/tarik tidak menyebut nomor revisi: admin menerbitkan versi tersimpan yang terlihat di pratinjau, dan perubahan orang lain tetap aman sebagai revisi;
  - `sort_order` artikel baru dihitung tanpa kunci: kolom tidak unik, urutan cadangan slug;
  - jendela diam admin dihitung dari saat masuk sampai permintaan admin pertama (sesuai desain).

## 5. Keputusan pelaksanaan

| #    | Keputusan                                                                                                                                                                                                                                             |
| ---- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 3B-1 | Status admin (aktivitas, konfirmasi) di kunci Valkey terpisah, bukan di rekaman sesi: bentuk sesi semua pengguna tidak berubah                                                                                                                        |
| 3B-2 | Alasan bundel ditolak sebelumnya tidak disimpan; ditambah `forecast_artifacts.reject_reasons` (migrasi `0012`) untuk halaman pemantauan                                                                                                               |
| 3B-3 | Konfirmasi sandi diminta di formulir itu sendiri, bukan halaman terpisah (rencana T9): artikel panjang tidak hilang saat jendela 10 menit habis                                                                                                       |
| 3B-4 | Status konfirmasi dirender per halaman, bukan di layout: Next.js tidak merender ulang layout setelah aksi                                                                                                                                             |
| 3B-5 | Tag cache artikel dikedaluwarsakan seketika (`revalidateTag(tag, { expire: 0 })`); tag data tetap `'max'`. Tanpa ini, artikel yang baru diterbitkan tetap "tidak ditemukan" untuk pengunjung berikutnya, dan artikel yang ditarik masih tampil sekali |
| 3B-6 | Validator Markdown di subpath kontrak sendiri (`@kawan-pasar/contracts/article-body`) dengan `mdast-util-from-markdown` 2.1.0 (versi yang sudah dipakai `react-markdown`), agar parser tidak masuk bundel peramban                                    |
| 3B-7 | Gambar memakai `<img>` biasa, bukan `next/image`: server tidak perlu mengambil gambar pihak ketiga                                                                                                                                                    |
| 3B-8 | Cek infra "revalidasi → basi" kini memakai `/pasar` (tag `markets`); `/edukasi` dicek dengan perilaku baru (render baru)                                                                                                                              |

## 6. Tangkapan layar

- [`fase-3b/admin-pengajuan-1280.png`](fase-3b/admin-pengajuan-1280.png): pengajuan dengan email tersamar dan kolom sandi di formulir
- [`fase-3b/admin-artikel-1280.png`](fase-3b/admin-artikel-1280.png): editor, pratinjau versi tersimpan, riwayat revisi
- [`fase-3b/admin-artikel-360.png`](fase-3b/admin-artikel-360.png): editor di 360 px
- [`fase-3b/admin-pemantauan-1280.png`](fase-3b/admin-pemantauan-1280.png): antrean, impor, bundel

## 7. Catatan untuk pemilik

- Setelah menarik kode: `pnpm --filter @kawan-pasar/api db:migrate` (migrasi `0011`, `0012`).
- Admin pertama: `pnpm --filter @kawan-pasar/api admin:grant <email>` (akun harus sudah terdaftar).
- **Domain gambar tim belum disebut.** Tambahkan ke `.env`: `ARTICLE_IMAGE_ORIGINS=https://upload.wikimedia.org,https://images.unsplash.com,https://<domain-tim>`, lalu bangun ulang api dan web.
- DB baru (mesin rekan): `pnpm --filter @kawan-pasar/api articles:import` sekali untuk isi awal artikel.
- Masih terbuka dari sebelumnya: Tabel 4.5 laporan v04, tanggal SKB 2027, 5 draf artikel (kini bisa disunting di `/admin/artikel`), `PUBLIC_SITE_URL` https.

## 8. Perbaikan uji

- Uji e2e Mode Analis (3A) memberi peran lewat SQL tanpa menutup pengajuan, sehingga pengajuan "menunggu" milik akun uji tertinggal di DB dev dan tampil di halaman admin. Kini SQL uji meniru `role:grant` (menutup pengajuan sebagai disetujui).
