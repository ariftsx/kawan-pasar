# ADR 0011 — Cookie sesi dan CSP ber-nonce untuk halaman akun

- Status: **Diterima** (17 Nov 2026, Fase 2A Task 0)
- Terkait: desain Fase 2 §3; ADR 0008 (CSP hibrida), ADR 0010 (cache bersama)

## Konteks

1. Desain meminta cookie sesi `__Host-` dengan `Secure`. Lingkungan lokal berjalan lewat `http://127.0.0.1:8080`, tanpa TLS.
2. ADR 0008 menjanjikan CSP ber-nonce untuk halaman yang dirender per permintaan. CSP statis saat ini dipasang ke semua path lewat `next.config.ts`. Halaman publik harus tetap statis/ISR dan dapat di-cache.

## Hasil spike (Chromium dari Playwright 1.65, build produksi Next 16.4.6)

1. **Cookie:**
   - `__Host-kp_session=…; Path=/; Secure; HttpOnly; SameSite=Lax` yang dikirim lewat http diterima dan dikirim balik di `127.0.0.1` maupun `localhost`.
   - Chromium (dan Firefox) memperlakukan host loopback sebagai konteks aman, sehingga tidak perlu nama cookie lain untuk lokal.
2. **CSP:**
   - `proxy.ts` membuat nonce per permintaan, meneruskannya ke Next lewat header permintaan `x-nonce` dan `content-security-policy`, lalu memasang header respons yang sama.
   - Next menyematkan nonce ke **semua** skripnya (13 dari 13), hidrasi berjalan, dan konsol bersih.
   - Header dari `proxy.ts` **menggantikan** header CSP statis `next.config.ts` untuk rute itu: hanya satu header terkirim.
   - Halaman publik di build yang sama tetap ber-CSP statis dan tetap ter-cache (`s-maxage`).

## Keputusan

- Cookie sesi selalu `__Host-kp_session`, dengan `Path=/; Secure; HttpOnly; SameSite=Lax`, tanpa `Domain`.
  - Masa berlaku cookie mengikuti masa mutlak sesi (30 hari).
  - Server tetap memeriksa masa diam (7 hari).
- Produksi wajib https. Di luar host loopback, browser menolak cookie `Secure` lewat http, sehingga salah konfigurasi langsung terlihat (tidak diam-diam berjalan tanpa `Secure`).
- Rute akun ditangani `proxy.ts`:
  - nonce acak 128 bit (base64);
  - `script-src 'nonce-…' 'strict-dynamic'` tanpa `'unsafe-inline'`;
  - direktif lain sama dengan CSP publik;
  - `Cache-Control: private, no-store`.
  - Halaman akun memakai `dynamic = 'force-dynamic'`, sehingga tidak pernah masuk cache ISR bersama (ADR 0010).
- `next.config.ts` tetap memasang CSP statis ke semua path. Rute akun mendapat header pengganti dari `proxy.ts`, dan uji e2e memastikan hanya satu CSP, yaitu yang ber-nonce, terkirim di rute akun.

## Akibat

- XSS di halaman akun (satu-satunya halaman yang memegang sesi) tidak bisa menjalankan skrip inline yang disuntikkan.
- Halaman akun dirender per permintaan. Jumlahnya kecil dan hanya untuk pengguna yang masuk, sehingga beban web untuk pengunjung publik tidak berubah.
