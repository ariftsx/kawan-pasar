# Audit Fase 3A — Mode Analis

- Tanggal: 23 November 2026
- Rencana: [`docs/plans/2026-11-19-fase-3a-mode-analis.md`](../plans/2026-11-19-fase-3a-mode-analis.md) (P1–P4 diputuskan pemilik)
- Desain: [`docs/design/2026-11-19-fase-3-analis-dan-admin-design.md`](../design/2026-11-19-fase-3-analis-dan-admin-design.md) § 2
- Status: **20/20 gerbang lulus** (§ 2: dua gerbang diperbaiki atau diulang)

## 1. Yang dihasilkan

| Bagian             | Hasil                                                                                                                                                                                                                                                                               |
| ------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Peran dan data     | Migrasi `0010_analyst`: `user_role` (`user`, `analyst`, `admin`), `analyst_requests` (satu `pending` per akun), `audit_log` (append-only untuk aplikasi, retensi 1 tahun lewat `prune_audit_log()`). CLI `role:grant <email> analyst\|user`, tidak pernah menyentuh admin           |
| API                | `GET /v1/analyst`, `POST /v1/analyst/request`, `GET /v1/analyst/export/prices.csv` dan `forecasts.csv` (peran dibaca dari DB tiap permintaan, 30/jam, maks 100.000 baris, anti-injeksi formula, `audit_log`). Kode galat baru `forbidden` (403)                                     |
| `/analis` (publik) | Grafik perbandingan SVG (indeks, harga, perubahan; 90H/1T/3T/Semua; pilih komoditas), unduh PNG berjudul + legenda + sumber, kartu cakupan data, tabel perkiraan ARIF-Net 7/30/90/365 hari, panel unduh CSV. ISR 10 menit; tanpa JS grafik bawaan, tabel, dan formulir tetap tampil |
| Unduhan CSV (web)  | Route Handler `/analis/unduh/harga.csv` dan `prediksi.csv`: tanpa sesi → `/masuk?ke=/analis`, tanpa peran → `/akun#mode-analis`, batas → pesan 429, permintaan lintas situs ditolak                                                                                                 |
| Akun dan navigasi  | Bagian "Mode Analis" di `/akun` (peran, status pengajuan, formulir). Tautan di Lainnya, footer, ARIF-Net, dan Prediksi. Kebijakan privasi diperbarui                                                                                                                                |

## 2. Gerbang mutu (`COMPOSE_PARALLEL_LIMIT=1 pnpm audit:all`)

| Gerbang                                                                                                                                                                                                         | Hasil                                                                                                                                                                                                                                                              |
| --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| lint, typecheck, unit-tests, web-build, stack-rebuild, infra, integration-tests, e2e-smoke, test-db-reset, ingest (pytest, mypy, ruff), model (pytest, mypy, ruff), dependency-audit, no-any, no-ai-attribution | ✔                                                                                                                                                                                                                                                                  |
| format                                                                                                                                                                                                          | ✔ setelah `prettier --write` pada 3 berkas yang diubah saat memperbaiki temuan tinjauan; `pnpm format:check` lalu bersih                                                                                                                                           |
| lighthouse                                                                                                                                                                                                      | ✔ diulang. Pada audit, TBT tiga halaman sedikit di atas 200 ms (201–208 ms), termasuk `/edukasi/…` yang tidak berubah. Host saat itu terbebani (stack-rebuild 349 detik, biasanya ±40 detik). Diulang sendiri dengan perintah yang sama: 8/8 lulus, TBT 101–199 ms |

| Paket      | Uji                                                                                                                                                                          |
| ---------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| api        | 313 (unit + integrasi). Baru: CLI peran, pengajuan, pengajuan vs. pemberian peran bersamaan, peran dicabut → 403, CSV, batas 30/jam, retensi `audit_log` dan larangan DELETE |
| web        | 231 unit (baru: seri, indeks, rentang, format ringkas)                                                                                                                       |
| contracts  | 46 (baru: pengajuan, filter ekspor, `csvCell`)                                                                                                                               |
| e2e        | `analyst.spec.ts` 5 perjalanan: 360/1280 px + axe, tanpa JS, tamu → masuk, pengajuan → peran → unduh CSV harga dan prediksi                                                  |
| Lighthouse | 8 halaman publik termasuk `/analis` (profil mobile: LCP ±1,1 s, CLS 0, TBT 131–172 ms, JS 144,7 KB, perf 0,98–0,99, a11y 1)                                                  |

## 3. Simulasi pengguna akhir

| Pengguna       | Perjalanan                                                                                                      | Hasil |
| -------------- | --------------------------------------------------------------------------------------------------------------- | ----- |
| Pengunjung     | Buka `/analis`, ganti metrik ke harga dan rentang ke 90H (e2e), unduh PNG (skrip Playwright, § 6)               | ✔     |
| Pengunjung     | Klik "Unduh harga.csv" → diarahkan ke masuk, kembali ke `/analis` setelah masuk                                 | ✔     |
| Pengguna biasa | Unduh CSV → diarahkan ke `/akun#mode-analis` dengan formulir pengajuan                                          | ✔     |
| Pengaju        | Ajukan dengan alasan + instansi → "Pengajuan terkirim" → muat ulang: "sedang ditinjau"; ajukan lagi → ditolak   | ✔     |
| Analis         | Setelah `role:grant` → "Peran: Analis" → unduh `harga.csv` bawang merah (hanya baris bawang) dan `prediksi.csv` | ✔     |
| Analis dicabut | `role:grant … user` → unduhan berikutnya dengan sesi yang sama → 403 (uji integrasi API)                        | ✔     |

## 4. Tinjauan independen (baca-saja)

- **High:** tidak ada.
- **Medium (1, diperbaiki):** ekspor tanpa batas baris. Kini paling banyak 100.000 baris per berkas (seluruh riwayat saat ini ±6.000).
- **Low, diperbaiki (dengan uji yang gagal dulu bila bisa diuji):**
  1. Pengajuan bisa tertinggal `pending` bila CLI memberi peran di antara pengecekan dan _insert_. Kini pengecekan peran/email, _insert_, dan entri audit ada dalam satu transaksi yang mengunci baris pengguna; CLI mengunci baris yang sama.
  2. Route Handler hanya menolak `cross-site`. Kini `same-site` (subdomain saudara) juga ditolak.
  3. Pesan 429 bisa berbunyi "NaN menit" bila `Retry-After` tidak berupa angka. Kini jatuh ke 60 menit.
  4. `prune_audit_log()` kini memakai `search_path = pg_catalog, public` dan `public.audit_log`.
  5. `csvCell` kini juga menetralkan formula yang didahului spasi (`"  =1+1"`).
  6. Unduh PNG yang gagal kini menampilkan pesan, tidak lagi diam.
- **Diterima dan dicatat:** batas 30/jam memakai jendela tetap dan terhitung sebelum kueri (unduhan gagal tetap memakai kuota; di batas jam bisa sampai 60). Sama dengan batas akun lainnya (ADR 0011); cukup untuk mencegah penyalahgunaan ringan.

## 5. Keputusan pelaksanaan

| #    | Keputusan                                                                                                                                                                                                                                           |
| ---- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 3A-1 | CSV dibangun di memori, bukan _stream_ (rencana T4). Datanya ±6.000 baris (< 300 KB) dan kini dibatasi 100.000 baris                                                                                                                                |
| 3A-2 | `audit_log` append-only untuk `app_rw`; retensi lewat fungsi `SECURITY DEFINER` yang hanya menghapus entri > 365 hari                                                                                                                               |
| 3A-3 | Halaman di `/[market]/analis` + rewrite `/analis` (ADR 0009). Halaman statis `/analis` gagal dibangun karena mengambil data saat build                                                                                                              |
| 3A-4 | Unduhan di `/analis/unduh/*`, bukan `/api/analis/*` (rencana T7): URL yang dilihat pengguna tetap di bawah Mode Analis. Redirect memakai `Location` relatif karena origin di balik Traefik bernilai internal (`0.0.0.0:3000`)                       |
| 3A-5 | Panel CSV di halaman ISR berisi satu teks untuk semua keadaan; keadaan "masuk / ajukan / menunggu" ditangani lewat redirect ke `/masuk` atau `/akun#mode-analis` (rencana T6 meminta panel berubah per keadaan). Halaman tetap bisa di-cache publik |
| 3A-6 | Seri dikirim ke peramban dalam format ringkas (hari awal, selisih hari, harga). HTML turun dari 144 KB ke 84 KB dan TBT dari 442–510 ms ke 131–172 ms                                                                                               |
| 3A-7 | Kontrol grafik dirender sejak awal tetapi tersembunyi (`invisible`, `inert`) sampai hidrasi, untuk mencegah pergeseran tata letak (CLS 0,155 → 0)                                                                                                   |
| 3A-8 | Lighthouse hanya memakai profil mobile (4G lambat, CPU 4×) seperti halaman lain; rencana T9 menyebut juga desktop. Profil mobile lebih ketat, dan anggaran JS 170 KB yang sama berlaku                                                              |

## 6. Tangkapan layar

- [`fase-3a/analis-1280.png`](fase-3a/analis-1280.png): `/analis` di desktop
- [`fase-3a/analis-360.png`](fase-3a/analis-360.png): `/analis` di 360 px (bilah tab menempel di bawah layar dan tampak menimpa grafik hanya pada tangkapan halaman penuh)
- [`fase-3a/grafik-unduhan.png`](fase-3a/grafik-unduhan.png): PNG hasil tombol "Unduh grafik PNG"

## 7. Catatan untuk pemilik

- Migrasi `0010` sudah diterapkan ke DB dev. Setelah menarik kode di mesin lain: `pnpm --filter @kawan-pasar/api db:migrate`.
- Memberi peran Analis sampai Fase 3B: `pnpm --filter @kawan-pasar/api role:grant <email> analyst` (cabut dengan `user`).
- Cabai rawit hijau/merah belum punya data harga, jadi tampil "Data belum tersedia" di Mode Analis.
- Fase 3B (halaman admin, `admin:grant`, editor artikel) menunggu rencana dan persetujuan Anda setelah commit 3A.
