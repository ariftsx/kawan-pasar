# Autentikasi dan Akun (Fase 2A)

Rancangan: `docs/design/2026-11-17-fase-2-akun-dan-peringatan-design.md` §3. Keputusan cookie/CSP: ADR 0011. Semua angka kebijakan ada di `apps/api/src/modules/auth/policy.ts`, `auth-rate-limiter.ts`, dan env.

## Alur dan pembagian tugas

| Lapisan          | Tugas                                                                                                                                                      |
| ---------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Browser          | Cookie `__Host-kp_session` (HttpOnly, Secure, SameSite=Lax, Path=/). Formulir tetap bekerja tanpa JavaScript                                               |
| Next.js (BFF)    | Server Actions: validasi kontrak, panggil API (`no-store`), pasang/hapus cookie. Halaman akun dinamis dengan CSP ber-nonce, `private, no-store`, `noindex` |
| Core API         | Identitas: Argon2id, sesi, token sekali pakai, lockout, rate limit akun, audit                                                                             |
| Worker           | Antrean email (BullMQ) → SMTP (Mailpit lokal); retensi data akun harian                                                                                    |
| PostgreSQL       | `users`, `auth_tokens` (hanya SHA-256 token), `auth_events` (tanpa email; IP sebagai HMAC harian)                                                          |
| `valkey-session` | Sesi (kunci = SHA-256 token), lockout, penghitung rate limit akun. `noeviction`, tanpa disk                                                                |

## Kebijakan

| Hal              | Nilai                                                                                                                                                                           |
| ---------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Hash kata sandi  | Argon2id m = 19 MiB, t = 2, p = 1 (OWASP). Hash lama diperbarui otomatis saat masuk                                                                                             |
| Kata sandi baru  | 12–128 code point, tanpa aturan komposisi. Ditolak bila sama dengan email atau ada di daftar bocor (31.658 entri ≥ 12 karakter dari SecLists, `apps/api/data/`)                 |
| Sesi             | Token acak 32 byte. Berakhir setelah 7 hari tidak dipakai atau 30 hari sejak dibuat. Rotasi saat masuk; ganti/atur ulang sandi mencabut sesi lain; hapus akun mencabut semua    |
| Lockout per akun | 5 gagal → 1 menit, 10 → 15 menit, 20 → 1 jam (jendela 1 jam). Berlaku juga untuk alamat tanpa akun, dan untuk konfirmasi sandi (ganti sandi, hapus akun)                        |
| Rate limit akun  | Masuk 10/menit per IP. Daftar, lupa sandi: 5/jam per IP dan per email. Kirim ulang verifikasi: 5/jam per akun. Ditambah batas global 120/menit per IP dan batas Traefik         |
| Kapasitas hash   | `HashGate`: paling banyak `AUTH_HASH_CONCURRENCY` (2) hash bersamaan, `AUTH_HASH_QUEUE` (16) menunggu ≤ 2 detik; selebihnya 429 `Retry-After: 1`, tidak dihitung gagal masuk    |
| Token email      | Verifikasi 24 jam, atur ulang 30 menit; sekali pakai (UPDATE atomik); token baru membatalkan yang lama. Halaman tautan memakai tombol (POST) dan `Referrer-Policy: no-referrer` |
| CSRF             | SameSite=Lax + pemeriksaan Origin bawaan Server Actions + token CSRF per sesi di setiap formulir akun (dikirim API ke BFF lewat `GET /v1/me`), dibandingkan waktu-konstan       |
| Open redirect    | `?ke=` hanya path internal (`safeNext`: satu `/` di depan, tanpa `\`, `%2F`, spasi; origin sama; bukan halaman masuk; ≤ 512 karakter)                                           |
| Verifikasi email | Wajib sebelum peringatan aktif (keputusan pemilik). Akun bisa masuk dan mengatur tanpa verifikasi                                                                               |

## Tidak membocorkan keberadaan akun

- Daftar, lupa sandi, dan kirim ulang verifikasi menjawab **sama persis** (isi, status) untuk alamat terdaftar dan tidak.
- **Lupa sandi tidak mencari alamat di API sama sekali.** API hanya mengantrekan satu pekerjaan `forgot_password`. Worker yang mencari pengguna, membuat token, mencatat event, dan mengirim email; untuk alamat tak dikenal worker tidak melakukan apa pun (`apps/api/src/modules/mail/forgot.ts`). Waktu jawaban API sama untuk semua alamat, karena pekerjaannya memang sama (temuan tinjauan Fase 2A).
- Waktunya juga setara:
  - Kebijakan sandi dicek sebelum pencarian alamat.
  - Kedua jalur daftar menghitung satu hash.
  - Alamat tak dikenal mengantrekan pekerjaan `noop`.
  - Masuk dengan alamat tak dikenal menjalankan Argon2 terhadap hash tiruan.
- Diuji: selisih median waktu lupa sandi < 30 ms atas 20 percobaan.
- Pendaftaran dengan alamat yang sudah ada mengirim email "Anda sudah punya akun" ke pemiliknya.

## Sesi tidak bisa dihidupkan kembali

Penulisan "terakhir dilihat" memakai `SET … XX`: bila sesi dicabut di antara pembacaan dan penulisan, sesi tetap tercabut (sebelumnya penulisan tanpa syarat bisa menghidupkannya kembali di luar daftar sesi pengguna). Masuk ulang di browser yang sama juga mengakhiri sesi lamanya.

## Log dan audit

- Header `x-session-token`, `x-csrf-token`, `x-service-token`, dan `cookie` disamarkan di log API.
- Galat tak terduga dicatat sebagai jenis galat dan kode SQLSTATE/driver saja. Pesan galat database mengutip parameter kueri, termasuk alamat email (ditemukan di uji beban Fase 2A).
- Worker mencatat nama templat, percobaan ke-berapa, dan jenis galat saja.
- Log akses Traefik tidak mencatat path (`RequestPath: drop`), karena tautan email membawa token sekali pakai di query (temuan tinjauan Fase 2A). Diuji di `infra-check`.
- Pekerjaan email yang gagal (berisi alamat) dihapus dari antrean setelah 1 hari.
- `auth_events` disimpan 90 hari (job retensi harian di worker). Saat akun dihapus, event tetap ada tanpa `user_id`.

## Hasil uji beban (laptop, CPU dibatasi; rincian `docs/testing/uji-beban.md`)

Banjir masuk dengan sandi salah, selama 60 detik:

- 50 penyerang dari satu alamat;
- 50 penyerang dari alamat berbeda;
- 20 pengunjung biasa pada saat yang sama.

| Kondisi           | 429   | 5xx            | p95 halaman pengunjung |
| ----------------- | ----- | -------------- | ---------------------- |
| Tanpa `HashGate`  | 1.438 | 185 (7%)       | 3.113 ms               |
| Dengan `HashGate` | 3.952 | 150 (0,3–3,4%) | **460 ms**             |

Sisa 5xx terjadi pada ~500 permintaan per detik yang langsung ke API 0,4 vCPU (melewati batas Traefik). API tidak crash, tidak ada lockout palsu, dan tidak ada email di log.

## Tambahan Fase 2B

- **Nomor HP opsional** (daftar dan `/akun`): dinormalisasi ke E.164 (`+628…`), disimpan dengan AES-256-GCM. Kunci enkripsi dan kunci HMAC pencarian diturunkan dengan HKDF dari `PHONE_ENC_KEY`; id pengguna menjadi AAD, sehingga ciphertext yang dipindah ke baris lain tidak bisa dibuka. API hanya mengembalikan bentuk tersamar (`+62 812 •••• 7890`), dan nomor tidak pernah dicatat di log (diuji). Daftar dengan alamat yang sudah ada tidak mengubah nomornya. Nomor belum diverifikasi; verifikasi kepemilikan ada di Fase 2C.
- **Konfirmasi kata sandi** (daftar, atur ulang, ganti) diperiksa di Server Action dan tidak pernah dikirim ke API.
- **Tombol lihat/sembunyikan kata sandi** di semua isian sandi. Tombol baru muncul sesudah hidrasi: tanpa JavaScript tidak ada tombol mati. `aria-pressed` dan label yang berganti.
- **Peringatan**: semua endpoint memakai sesi + CSRF yang sama; kepemilikan diperiksa di kueri (uji IDOR). Tautan berhenti berlangganan ringkasan mingguan memakai token sekali pakai (`weekly_unsubscribe`, 14 hari, SHA-256 di `auth_tokens`); halaman `/berhenti-ringkasan` tidak bertindak saat dibuka (pemindai tautan email), hanya saat tombol ditekan, dan memakai `Referrer-Policy: no-referrer`.
- **Server Action**: hanya fungsi aksi yang diekspor dari modul `'use server'` (fungsi lain yang diekspor akan menjadi endpoint yang bisa dipanggil); helper ada di `lib/auth/action-helpers.ts`.
