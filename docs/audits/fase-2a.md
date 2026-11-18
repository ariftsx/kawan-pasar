# Audit Fase 2A — Akun dan Keamanan

- Tanggal: 18 November 2026
- Rencana: [`docs/plans/2026-11-17-fase-2a-akun-dan-keamanan.md`](../plans/2026-11-17-fase-2a-akun-dan-keamanan.md)
- Desain: [`docs/design/2026-11-17-fase-2-akun-dan-peringatan-design.md`](../design/2026-11-17-fase-2-akun-dan-peringatan-design.md)
- Status: **16/17 gerbang lulus. `dependency-audit` menunggu keputusan pemilik (§ 8.1). Layar akun menunggu tinjauan pemilik (§ 7).**

## 1. Yang dihasilkan

| Area          | Hasil                                                                                                                                                                      |
| ------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Akun          | Daftar, verifikasi email, masuk/keluar, lupa/atur ulang sandi, ganti sandi, sesi aktif (cabut), hapus akun; formulir bekerja tanpa JavaScript                              |
| Keamanan      | Argon2id + batas kapasitas hash, daftar sandi bocor, sesi hanya sebagai hash, lockout, rate limit akun, token sekali pakai, CSRF per sesi, cookie `__Host-`, CSP ber-nonce |
| Privasi       | `/privasi`, data minimum, retensi 90 hari untuk audit, hapus akun permanen, tanpa email/token di log                                                                       |
| Infrastruktur | `valkey-session` (noeviction), Mailpit (lokal), `worker` (email lewat BullMQ, retensi harian)                                                                              |
| Dokumen       | ADR 0011, `docs/security/autentikasi.md`, kontrak API akun, cookie & privasi, uji beban login                                                                              |

## 2. Gerbang mutu (`pnpm audit:all`, 18 Nov 2026)

| Gerbang                                                                                                                                            | Hasil                                                                             |
| -------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------- |
| lint, typecheck, web-build, stack-rebuild, infra (39 pemeriksaan), integration, lighthouse, ingest (pytest, mypy, ruff), no-any, no-ai-attribution | ✔                                                                                 |
| format                                                                                                                                             | ✔ setelah satu berkas uji dirapikan                                               |
| e2e                                                                                                                                                | ✔ 294/294 (2 uji diperbaiki; lihat § 4)                                           |
| dependency-audit                                                                                                                                   | ✘ `picomatch` ≤ 4.0.7 (GHSA-fc5q-39xc-vjpf), **belum ada versi perbaikan**; § 8.1 |

| Paket      | Uji                                                                                                  |
| ---------- | ---------------------------------------------------------------------------------------------------- |
| api        | 80 unit + 149 integrasi (akun, sesi, lockout, token, kapasitas hash, email, retensi, log)            |
| web        | 215 unit + 2 integrasi                                                                               |
| contracts  | 31 unit                                                                                              |
| e2e        | 294 skenario: 17 perjalanan dan keamanan akun, halaman akun di semua lebar/axe/teks 200%/anggaran JS |
| Lighthouse | 7 halaman publik tetap dalam anggaran (LCP ≤ 1,18 s, TBT ≤ 163 ms, JS ≤ 144 KB, a11y 100)            |

## 3. Simulasi pengguna akhir

| Perjalanan                                                                                                                                                                                                                                                             | Hasil |
| ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----- |
| Daftar → email di Mailpit → verifikasi (tombol) → masuk → akun (360 & 1280 px)                                                                                                                                                                                         | ✔     |
| Lupa sandi → tautan → sandi baru; sandi lama ditolak                                                                                                                                                                                                                   | ✔     |
| Ganti sandi mengeluarkan perangkat lain; pemberitahuan email terkirim                                                                                                                                                                                                  | ✔     |
| Sesi aktif: perangkat ini ditandai, perangkat lain bisa dikeluarkan                                                                                                                                                                                                    | ✔     |
| Keluar; hapus akun (salah sandi ditolak, lalu berhasil; tidak bisa masuk lagi)                                                                                                                                                                                         | ✔     |
| Tanpa JavaScript: daftar, masuk, keluar                                                                                                                                                                                                                                | ✔     |
| Keamanan di browser: flag cookie, satu CSP ber-nonce tanpa `unsafe-inline`, `?ke=` ke situs lain, tautan verifikasi tidak terpakai oleh GET, tautan reset sekali pakai, daftar ganda, lockout, formulir dari Origin asing, halaman publik tetap ter-cache tanpa cookie | ✔     |

## 4. Temuan selama pelaksanaan (diperbaiki, masing-masing dengan uji yang gagal dulu)

1. **Traefik menimpa `Referrer-Policy`** halaman bertoken menjadi `strict-origin-when-cross-origin`. Kini halaman yang mengaturnya sendiri.
2. **Keluar tidak menghapus cookie di browser.** Penghapusan cookie `__Host-` tanpa `Secure` diabaikan browser. Kini atributnya diulang lengkap.
3. **Banjir login dari banyak alamat menjatuhkan bagian API lain.** Argon2 yang berjalan bersamaan menghabiskan CPU dan membuat kueri database timeout: 185 × 500, p95 halaman pengunjung 3,1 s.
   - Perbaikan: `HashGate` (2 berjalan, 16 menunggu; selebihnya 429).
   - Hasil: p95 pengunjung 460 ms.
4. **Log galat API mengutip parameter kueri**, termasuk alamat email. Kini hanya jenis galat dan kode.
5. **Navigasi desktop membungkus dua baris di 1280 px** setelah tombol Akun ditambahkan. Kini ikon, dengan uji "satu baris".
6. **Gerbang `stack-rebuild` tidak membangun ulang `worker`**, sehingga worker menjalankan build lama. Kini ikut dibangun ulang.
7. **Uji e2e:** penanda alert milik Next (route announcer), urutan percobaan lockout, cara mereplikasi Server Action, dan `STALE` sebagai jawaban cache yang sah.

## 5. Tinjauan independen (model paling mampu, baca-saja)

- **Critical:** tidak ada.
- **Important (diperbaiki):**
  1. **Token email tercatat di log akses Traefik** (path beserta `?t=`). Kini `RequestPath` tidak dicatat; dijaga `infra-check`.
  2. **"Lupa sandi" membocorkan keberadaan akun lewat waktu.** Untuk alamat terdaftar ada transaksi token tambahan.
     - Kini API hanya mengantrekan satu pekerjaan yang sama untuk semua alamat, dan worker yang menyelesaikannya.
     - Ruling sebelumnya (uji median < 30 ms) salah untuk jalur ini dan sudah digantikan.
  3. **Sesi yang dicabut bisa hidup lagi** bila pencabutan terjadi di antara pembacaan dan penulisan "terakhir dilihat". Kini memakai `SET … XX`.
- **Minor diperbaiki:**
  - Masuk ulang mengakhiri sesi lama di browser yang sama.
  - Pekerjaan email gagal disimpan 1 hari (bukan 7), dan dinyatakan di `/privasi`.
- **Minor ditunda:**
  - Token sesi tidak dirotasi saat ganti sandi (sesi lain tetap dicabut).
  - Keluar menghapus cookie meski pencabutan di API gagal.
  - Pemeriksaan lockout dan verifikasi sandi tidak atomik (lonjakan dibatasi `HashGate`).

## 6. Keputusan pelaksanaan (rulings)

Rinciannya ada di buku catatan pelaksanaan. Ringkasnya:

- **Cookie dan sesi:**
  - Cookie selalu `__Host-kp_session` + `Secure` (host loopback adalah konteks aman). Produksi wajib https.
  - Sesi, lockout, dan penghitung rate limit akun di `valkey-session` (noeviction).
- **Data akun:**
  - Daftar sandi bocor: 31.658 entri ≥ 12 karakter (SecLists, MIT).
  - Index tambahan `auth_events(user_id)` dan CHECK hash harus Argon2id.
  - Token CSRF dikirim ke BFF lewat `GET /v1/me` (synchronizer token).
- **Alur akun:**
  - Atur ulang sandi memeriksa sandi baru sebelum memakai token (sandi lemah tidak menghanguskan tautan).
  - Konfirmasi sandi (ganti, hapus akun) dihitung ke lockout.
- **Infrastruktur dan halaman:**
  - `msgpackr-extract` (opsional, native) diblokir; BullMQ memakai versi JavaScript.
  - `/privasi` dan job retensi ditambahkan karena dijanjikan desain dan formulir persetujuan.
- **Uji e2e:**
  - Penghitung rate limit akun dikosongkan sebelum tiap uji akun, karena semua uji browser satu alamat. Lockout tidak.
- **Uji beban:**
  - Sisa 0,3–3,4% 5xx pada banjir login ~500 permintaan per detik langsung ke API 0,4 vCPU (melewati batas tepi) diterima dan dilaporkan.

## 7. Layar akun untuk ditinjau pemilik

Layar ini tidak ada di prototipe v0.4. Saya merancangnya dari token dan komponen yang ada (keputusan pemilik). Tangkapan layar ada di `docs/audits/fase-2a/`:

| Halaman    | 360 px                                       | 1280 px                                        |
| ---------- | -------------------------------------------- | ---------------------------------------------- |
| Masuk      | [masuk-360](fase-2a/masuk-360.png)           | [masuk-1280](fase-2a/masuk-1280.png)           |
| Daftar     | [daftar-360](fase-2a/daftar-360.png)         | [daftar-1280](fase-2a/daftar-1280.png)         |
| Lupa sandi | [lupa-sandi-360](fase-2a/lupa-sandi-360.png) | [lupa-sandi-1280](fase-2a/lupa-sandi-1280.png) |
| Akun saya  | [akun-360](fase-2a/akun-360.png)             | [akun-1280](fase-2a/akun-1280.png)             |

## 8. Catatan untuk pemilik

1. **Keputusan dibutuhkan: advisory `picomatch` (GHSA-fc5q-39xc-vjpf, ReDoS, tinggi).**
   - Belum ada versi perbaikan: 4.0.7 adalah versi terakhir, dan `first_patched_version` kosong.
   - Paket ini hanya dipakai alat build dan uji (vite/rollup lewat `unplugin-swc`, tooling). Tidak ada di bundel web maupun paket runtime API.
   - Opsinya:
     - (a) Abaikan advisory ini di `auditConfig` dengan alasan tercatat, dan tinjau lagi saat versi perbaikan rilis.
     - (b) Biarkan gerbang gagal sampai perbaikan rilis.
2. **Layar akun (§ 7) perlu ditinjau.**
3. **Masih terbuka:** 5 draf artikel dan `PUBLIC_SITE_URL` produksi. Produksi juga **wajib https** agar cookie sesi berfungsi.
