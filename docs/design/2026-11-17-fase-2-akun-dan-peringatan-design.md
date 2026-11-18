# Desain Fase 2 — Akun, Peringatan, dan Notifikasi

- Status: **Usulan, menunggu persetujuan pemilik** (17 Nov 2026)
- Induk: `docs/design/2026-11-11-kawan-pasar-design.md` §8 (model data fase berikutnya), §9 (keamanan), §14 (Fase 2)
- Prototipe: layar Peringatan v0.4 (`d_peringatan`, `m_peringatan`), status "WhatsApp terhubung" dan "Belum ada peringatan"

## 1. Maksud

Pengguna Terdaftar bisa membuat akun dengan email dan kata sandi. Akun itu dipakai untuk menerima kabar saat harga komoditas yang mereka pantau bergerak di luar kebiasaan: di aplikasi, lewat ringkasan mingguan, dan lewat WhatsApp.

Akun adalah data pribadi pertama di sistem ini, sehingga keamanannya menjadi fondasi untuk fitur lain. Halaman publik tetap statis dan dapat di-cache. Tidak ada render per pengguna di halaman publik.

## 2. Keputusan pemilik (17 Nov 2026)

1. **Tiga sub-fase**, masing-masing dengan rencana, audit, dan commit sendiri:
   - **2A** akun dan keamanan;
   - **2B** peringatan, notifikasi aplikasi, dan ringkasan mingguan;
   - **2C** WhatsApp dengan adapter tiruan.
2. **Email lokal ke Mailpit** (kontainer penangkap SMTP, kotak masuk web hanya di dev). Penyedia sungguhan tinggal mengganti env SMTP.
3. **Verifikasi email wajib sebelum peringatan aktif.** Akun bisa masuk dan mengatur, tetapi tidak ada kabar yang dikirim sebelum email terverifikasi.
4. **Layar akun dirancang dari sistem desain yang ada**, karena prototipe tidak memilikinya. Layar ini ditinjau pemilik lewat tangkapan layar di audit.
5. Dari Fase 1D: angka beban laptop diterima sebagai batas bawah (opsi a). Cache HTML di tepi direncanakan untuk tahap produksi.

## 3. Arsitektur akun (2A)

### Pembagian tanggung jawab

```
Browser ──cookie __Host-kp_session──▶ Next.js (BFF, Server Actions, halaman akun dinamis)
                                         │ x-service-token + x-session-token + X-Forwarded-For
                                         ▼
                                  Core API (NestJS): identitas, sesi, token, rate limit
                                         │                     │
                                   PostgreSQL              Valkey (sesi, lockout, antrean)
                                                                  │
                                                     worker (BullMQ) ──SMTP──▶ Mailpit
```

- **API pemilik logika identitas.** Ia menangani hash kata sandi, sesi, token sekali pakai, lockout, dan audit. Next.js hanya meneruskan, sehingga validasi ganda tetap berlaku: skema dari `@kawan-pasar/contracts` dicek di Server Action dan di API.
- **Next.js memegang cookie.**
  - Nama `__Host-kp_session`: `HttpOnly; Secure; SameSite=Lax; Path=/`, tanpa `Domain`.
  - Nilainya token acak 32 byte (base64url), tidak bermakna di luar sistem.
  - API hanya menyimpan **SHA-256 token**, sehingga kebocoran Valkey tidak memberi sesi yang bisa dipakai.
- **Worker** adalah image API yang sama dengan titik masuk `worker`. Kontainer terpisahnya tidak membuka port dan tidak dipercaya sebagai proxy. Email dikirim lewat antrean BullMQ (`valkey-queue`), sehingga:
  - waktu respons pendaftaran sama untuk email baru dan email yang sudah terdaftar (tidak ada kebocoran lewat waktu);
  - pengiriman gagal dicoba ulang dengan backoff;
  - SMTP yang lambat tidak menahan permintaan pengguna.

### Data (PostgreSQL)

| Tabel         | Kolom inti                                                                                                                         | Catatan                                                                                           |
| ------------- | ---------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------- |
| `users`       | `id` (uuid v7), `email` (citext, unik), `password_hash`, `email_verified_at`, `role` (`user`), `created_at`, `password_changed_at` | Email disimpan apa adanya, tetapi dibandingkan tanpa beda huruf. Panjang email ≤ 254              |
| `auth_tokens` | `id`, `user_id`, `purpose` (`verify_email`, `reset_password`), `token_hash` (unik), `expires_at`, `used_at`                        | Sekali pakai. Verifikasi berlaku 24 jam, reset 30 menit. Token lama dengan tujuan sama dibatalkan |
| `auth_events` | `id`, `user_id` (nullable, `ON DELETE SET NULL`), `type`, `ip_hash`, `created_at`                                                  | Rekam audit tanpa email, kata sandi, atau token. IP di-hash dengan garam harian. Retensi 90 hari  |

Hak akses: `app_rw` mendapat `SELECT/INSERT/UPDATE/DELETE` hanya pada tabel ini. `ingest_w` tidak menyentuhnya.

### Sesi (Valkey `valkey-cache`, database 2)

- Kunci `kp:v1:sess:<sha256>` berisi `{userId, createdAt, lastSeenAt, csrf, ua}`.
  - Masa diam 7 hari (diperpanjang saat dipakai, paling sering sekali per 5 menit).
  - Masa mutlak 30 hari.
- Set `kp:v1:usess:<userId>` mendaftar sesi milik pengguna. Dipakai untuk daftar "Sesi aktif", mencabut satu sesi, mencabut semuanya saat kata sandi diganti, dan menghapus akun.
- `valkey-cache` memakai `allkeys-lru`. Agar sesi tidak bisa diusir, sesi disimpan di **database 2 milik instans terpisah** `valkey-session` (`noeviction`, tanpa persistensi disk). Bila instans itu mati, semua pengguna perlu masuk ulang, dan itu dapat diterima.

### Kebijakan keamanan (desain §9, ASVS L2)

| Hal              | Keputusan                                                                                                                                                                                                |
| ---------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Hash kata sandi  | Argon2id, parameter OWASP: m = 19 MiB, t = 2, p = 1 (`@node-rs/argon2`). Hash diperbarui saat masuk bila parameter berubah                                                                               |
| Kebijakan sandi  | 12–128 karakter, tanpa aturan komposisi. Ditolak bila ada di daftar sandi bocor (100 ribu teratas, SecLists, MIT, disimpan di repo) atau sama dengan email                                               |
| Pesan galat      | Generik: "Email atau kata sandi salah". Daftar dengan email yang sudah ada dijawab sama dengan sukses ("cek email Anda"), lalu email pemberitahuan dikirim ke pemiliknya. Lupa sandi selalu dijawab sama |
| Rate limit       | Per IP: 10 percobaan masuk per menit. Per akun: lockout bertahap, 5 gagal → 1 menit, 10 → 15 menit, 20 → 1 jam (di Valkey). Daftar dan lupa sandi: 5 per jam per IP dan per email                        |
| Sesi             | Token baru setiap kali masuk (rotasi). Ganti sandi mencabut semua sesi lain. Sesi dapat dicabut satu per satu. Keluar menghapus sesi di server                                                           |
| CSRF             | `SameSite=Lax` + pemeriksaan Origin bawaan Server Actions + token CSRF per sesi di setiap formulir mutasi, diperiksa API dengan perbandingan waktu-konstan                                               |
| Token di URL     | Tautan verifikasi dan reset membuka halaman berisi tombol (`POST`), sehingga pemindai tautan email tidak memakai token. `Referrer-Policy: no-referrer` di halaman itu                                    |
| CSP halaman akun | Dinamis, ber-nonce: `script-src 'nonce-…' 'strict-dynamic'` (ADR 0008), `Cache-Control: private, no-store`                                                                                               |
| Hapus akun       | Wajib memasukkan kata sandi. Pengguna, token, dan sesinya dihapus permanen. Rekam audit tetap ada tanpa `user_id`                                                                                        |
| Log              | Tanpa email, kata sandi, token, atau cookie. Pengguna dirujuk dengan id                                                                                                                                  |

### Halaman (2A)

| Rute                    | Isi                                                                                                     |
| ----------------------- | ------------------------------------------------------------------------------------------------------- |
| `/masuk`                | Email, kata sandi, tautan lupa sandi dan daftar. Setelah masuk, kembali ke `?ke=` (hanya path internal) |
| `/daftar`               | Email, kata sandi (dengan petunjuk panjang), persetujuan kebijakan privasi                              |
| `/lupa-sandi`           | Email. Jawaban selalu sama                                                                              |
| `/atur-ulang-sandi?t=…` | Sandi baru. Token dikirim lewat formulir                                                                |
| `/verifikasi-email?t=…` | Tombol "Verifikasi email saya"                                                                          |
| `/akun`                 | Email dan status verifikasi (kirim ulang), ganti sandi, sesi aktif, keluar, hapus akun                  |

- Navigasi publik tetap statis. Item "Akun" menuju `/akun`, yang mengalihkan ke `/masuk?ke=/akun` bila belum masuk. Tidak ada status masuk yang dirender di halaman publik, dan tidak ada JS tambahan untuk itu.
- Tata letak: kartu formulir sempit (maks. 440 px) di atas kanvas, Kapa berpose sesuai konteks, komponen `Button` dan `SelectField` yang ada ditambah `TextField` dan `PasswordField`. Galat ditampilkan per kolom (`aria-describedby`) dan sebagai ringkasan di atas formulir (fokus berpindah ke ringkasan).

## 4. Garis besar 2B dan 2C (dirinci di rencananya masing-masing)

### 2B — Peringatan, notifikasi aplikasi, ringkasan mingguan

- **`alert_subscriptions`:** pengguna × komoditas × pasar, dengan pilihan aturan sesuai prototipe:
  - **Pergerakan di luar kebiasaan:** perubahan 7 hari melewati batas historis komoditas (persentil 90 perubahan mingguan).
  - **Prediksi naik lebih dari 2%:** hanya untuk komoditas yang bisa diprediksi, dengan versi model di pesannya.
  - **Harga melewati batas saya:** ambang Rupiah dari pengguna.
- **Evaluasi berbasis kejadian.** Setelah impor harga atau promosi bundel, API menaruh satu pekerjaan di antrean. Worker mengevaluasi semua langganan dalam query berkelompok (tanpa N+1). Kunci idempoten (pengguna, aturan, tanggal data) mencegah kabar ganda.
- **`notifications`:** kabar di aplikasi, dengan status dibaca, tab "Semua / Belum dibaca / Ringkasan mingguan", dan "Tandai semua dibaca". Lonceng di navigasi membaca jumlah belum dibaca lewat Route Handler kecil yang tidak di-cache. Ini satu-satunya JS per pengguna, dan hanya dimuat di halaman akun/peringatan.
- **Ringkasan mingguan:** pekerjaan berulang BullMQ setiap Senin 06.00 WIB, isi fakta saja (aturan bahasa non-kausal), dikirim ke aplikasi dan email.
- Hanya akun terverifikasi yang menerima kabar.

### 2C — WhatsApp (adapter tiruan)

- **`whatsapp_channels`:** nomor dienkripsi di tingkat kolom (AES-256-GCM, kunci dari env, kolom `nonce` + `ciphertext`). Pencarian memakai HMAC nomor. Status: `pending`, `verified`, atau `stopped`.
- **Verifikasi nomor** dengan kode 6 digit (berlaku 10 menit, 5 percobaan). Balasan "STOP" menghentikan pengiriman.
- **Antarmuka `WhatsAppSender`:** adapter tiruan menulis ke kotak keluar lokal yang bisa dilihat di Mailpit (sebagai email "WA tiruan"). Adapter WhatsApp Business API sungguhan di luar lingkup.
- Status "WhatsApp terhubung" dari prototipe.

## 5. Di luar lingkup Fase 2

- Login sosial dan 2FA (dapat ditambahkan nanti; tabel dirancang tanpa menghalanginya).
- Peran analis dan admin (Fase 3).
- Penyedia email dan WhatsApp sungguhan, serta penerapan produksi.
