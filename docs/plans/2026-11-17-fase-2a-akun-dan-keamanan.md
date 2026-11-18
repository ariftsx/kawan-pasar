# Fase 2A — Akun dan Keamanan: Rencana Implementasi

**Status:** selesai (18 Nov 2026) — audit `docs/audits/fase-2a.md`.

**Tujuan:** Pengguna dapat:

- mendaftar dengan email dan kata sandi;
- memverifikasi email;
- masuk dan keluar;
- mengatur ulang kata sandi;
- mengganti kata sandi;
- melihat dan mencabut sesi;
- menghapus akunnya.

Semua dengan kontrol keamanan desain §9 (ASVS L2), sementara halaman publik tetap statis.

**Arsitektur** (desain Fase 2 §3):

- API NestJS memegang identitas: Argon2id, sesi di Valkey terpisah, token sekali pakai, lockout, dan audit.
- Next.js memegang cookie `__Host-kp_session` dan menjalankan Server Actions.
- Halaman akun dirender per permintaan dengan CSP ber-nonce.
- Email dikirim worker BullMQ ke Mailpit.

**Tech stack baru:**

- Paket: `@node-rs/argon2` 2.2.2, `bullmq` (versi stabil terbaru yang lolos gerbang usia rilis, peer ioredis 6), `nodemailer` 10.5.0 + `@types/nodemailer` 8.0.2.
- Image `axllent/mailpit:v1.33.1`.
- Daftar sandi bocor: SecLists `10-million-password-list-top-100000` (MIT), disimpan sebagai berkas di repo.

**Spec:** `docs/design/2026-11-17-fase-2-akun-dan-peringatan-design.md` (§2 keputusan pemilik, §3 arsitektur akun), desain induk §9, ADR 0005 dan 0008.

## Batasan global

- Semua batasan Fase 0–1D tetap berlaku, terutama:
  - tanpa atribusi AI;
  - git oleh pemilik;
  - TypeScript strict tanpa `any`;
  - validasi ganda dari `@kawan-pasar/contracts`;
  - halaman publik tetap statis/ISR, dan anggaran Lighthouse tetap lulus.
- Tidak ada email, kata sandi, token, cookie, atau nomor di log, pesan galat, maupun rekam audit.
- Setiap respons yang menyangkut akun memakai `Cache-Control: private, no-store`. Halaman akun tidak pernah masuk cache bersama (ADR 0010).
- Jawaban yang bisa membocorkan keberadaan akun (daftar, lupa sandi, kirim ulang verifikasi) identik isinya, statusnya, dan kira-kira waktunya.
- Semua angka kebijakan (masa sesi, lockout, rate limit) ada di satu modul konstanta dan bisa disetel lewat env bila disebut di desain.

## Fokus tinjauan

1. **Enumerasi akun.** Daftar, lupa sandi, kirim ulang verifikasi, dan masuk tidak boleh membedakan email terdaftar dari yang tidak, baik lewat isi, status, maupun waktu (Task 5, 8).
2. **Sesi.**
   - Token tidak pernah disimpan mentah.
   - Rotasi saat masuk; pencabutan saat ganti sandi dan hapus akun.
   - Sesi kedaluwarsa (diam dan mutlak) ditolak.
   - Cookie: `__Host-`, `HttpOnly`, `Secure`, `SameSite=Lax` (Task 0, 4, 7, 8).
3. **CSRF dan open redirect.** Mutasi tanpa token CSRF atau dengan Origin asing ditolak. `?ke=` hanya menerima path internal (Task 5, 7, 8).
4. **Token di URL.** Token verifikasi dan reset tidak terpakai oleh GET (pemindai email), tidak bocor lewat Referer, sekali pakai, dan kedaluwarsa (Task 5, 7, 8).
5. **Brute force dan beban.**
   - Rate limit per IP dan lockout per akun bekerja di antara dua replika web dan API.
   - Banjir percobaan masuk dijawab 429 tanpa menjatuhkan API (Argon2 mahal) (Task 4, 9).

---

### Task 0: Spike — cookie `__Host-` lewat http lokal dan CSP ber-nonce per rute

**Files:** `docs/architecture/adr/0011-sesi-dan-csp-akun.md` (hasil), kode spike dibuang.

- [ ] **Cookie:** di Chromium (Playwright) terhadap `http://127.0.0.1:8080`, apakah `__Host-kp_session` dengan `Secure` diterima dan dikirim balik?
  - Bila tidak: nama cookie dan `Secure` ditentukan oleh `PUBLIC_SITE_URL` (https → `__Host-kp_session` + `Secure`; http lokal → `kp_session` tanpa `Secure`, hanya bila host loopback).
  - Aturan ini dikunci uji: produksi wajib https.
- [ ] **CSP:** satu halaman dinamis di bawah `/akun` dengan nonce dari `proxy.ts` (`x-nonce` + header `Content-Security-Policy` per permintaan), sementara `next.config.ts` mengecualikan rute akun dari header CSP statis.
  - Verifikasi: skrip Next membawa nonce dan konsol bersih.
  - Verifikasi: halaman publik tetap memakai CSP statis dan tetap ISR.
- [ ] Catat keputusan di ADR 0011.

### Task 1: Infrastruktur — `valkey-session`, Mailpit, worker, rahasia baru

**Files:** `infra/compose/docker-compose.yml`, `docker-compose.dev-tools.yml`, `scripts/gen-env.mjs`, `.env.example`, `scripts/infra-check.mjs`, `docs/operations/menjalankan-lokal.md`

- **`valkey-session`:** `noeviction`, tanpa disk, `maxmemory 64mb`, password sama dengan Valkey lain.
- **`mailpit`:** SMTP 1025 hanya di `backend`. Kotak masuk web di 127.0.0.1:18025 (dev-tools saja).
- **`worker`:** image API, `command: node dist/worker.js`, read-only, non-root, `mem_limit` 256m, tanpa port. Alamat dinamis, sehingga **tidak** dipercaya sebagai proxy.
- **Env:**
  - `VALKEY_SESSION_URL`, `SMTP_URL` (`smtp://mailpit:1025`), `MAIL_FROM`, `PUBLIC_SITE_URL` (API, untuk tautan email).
  - `AUTH_SECRET`: HMAC untuk `ip_hash` dan kunci lockout per email. Masuk `LATER_SECRETS` di `gen-env`.
- **Pemeriksaan infra baru:**
  - ketiga layanan sehat;
  - `valkey-session` menolak tanpa password dan berkebijakan `noeviction`;
  - Mailpit tidak terjangkau dari luar kecuali port dev;
  - worker tidak membuka port.

- [ ] Pemeriksaan GAGAL → implementasi → LULUS.
- [ ] Checkpoint (pemilik): `feat(infra): valkey sesi, mailpit, dan worker`

### Task 2: Skema dan migrasi

**Files:** `apps/api/src/database/schema/{users,auth-tokens,auth-events}.ts`, migrasi `0005_accounts.sql` (+ `citext`, hak akses), `apps/api/test/database/accounts.int.test.ts`

**Interfaces (Produces):**

- `users(id uuid default uuidv7(), email citext unique not null check length ≤ 254, password_hash text not null, email_verified_at timestamptz, role user_role not null default 'user', password_changed_at timestamptz not null default now(), created_at …)`
- `auth_tokens(id bigint identity, user_id uuid references users on delete cascade, purpose auth_token_purpose, token_hash bytea unique (32 byte), expires_at, used_at, created_at)` + indeks `(user_id, purpose)`
- `auth_events(id bigint identity, user_id uuid references users on delete set null, type auth_event_type, ip_hash bytea, created_at)` + indeks `created_at`
- Hak: `app_rw` CRUD hanya pada tabel ini; `ingest_w` tanpa akses.

**Uji:**

- email unik tanpa beda huruf;
- panjang email ditolak bila > 254;
- token_hash unik;
- hapus pengguna menghapus token dan mengosongkan `user_id` di event;
- `ingest_w` ditolak membaca `users`.

- [ ] GAGAL → migrasi → LULUS. Checkpoint: `feat(db): tabel akun, token, dan audit`

### Task 3: Kontrak

**Files:** `packages/contracts/src/auth.ts` (+ ekspor subpath `./auth` yang tidak menarik skema lain), `auth.test.ts`

**Interfaces (Produces):**

- `EmailSchema`: trim, huruf kecil untuk perbandingan, format, ≤ 254.
- `PasswordSchema`: 12–128 karakter Unicode, tanpa aturan komposisi.
- `RegisterInput {email, password, acceptPrivacy: true}`, `LoginInput {email, password}`, `ForgotInput {email}`, `ResetInput {token, password}`, `VerifyInput {token}`, `ChangePasswordInput {current, next}`, `DeleteAccountInput {password}`.
- `TokenSchema`: base64url 43 karakter.
- `MeResponse {id, email, emailVerified, createdAt}`, `SessionsResponse {items: {id, current, createdAt, lastSeenAt, device}[]}`.
- `AuthErrorCode`: `invalid_credentials | locked | rate_limited | weak_password | invalid_token | csrf | unauthenticated`.

Semua skema `strict`. Uji batas panjang, Unicode, dan properti asing.

- [ ] GAGAL → LULUS. Checkpoint: `feat(contracts): skema akun`

### Task 4: Inti identitas di API

**Files:** `apps/api/src/modules/auth/{password.service,breached-passwords,session.store,lockout.service,auth-token.service,auth-events.repository}.ts`, `apps/api/data/breached-top-100k.txt.gz` (+ `LICENSE`/sumber), uji unit dan integrasi

**Interfaces (Produces):**

- `PasswordService.hash(pw)`, `.verify(hash, pw) → {ok, needsRehash}`, `.policyProblem(pw, email) → 'too_short' | 'too_long' | 'breached' | 'same_as_email' | null`.
- `SessionStore.create(userId, ua) → {token, csrf}`, `.read(token) → Session | null` (memperpanjang masa diam paling sering per 5 menit), `.revoke(token)`, `.revokeById(userId, id)`, `.revokeAll(userId, exceptToken?)`, `.list(userId)`.
  - Nilai: id sesi = 16 byte pertama hash, ditampilkan sebagai heksadesimal.
- `LockoutService.check(emailKey)`, `.fail(emailKey)`, `.reset(emailKey)`: ambang 5/10/20 → 60/900/3600 detik; kunci memakai HMAC `AUTH_SECRET`.
- `AuthTokenService.issue(userId, purpose) → token` (membatalkan token aktif dengan tujuan sama), `.consume(token, purpose) → userId | null` (atomik: `UPDATE … SET used_at = now() WHERE token_hash = $1 AND used_at IS NULL AND expires_at > now() RETURNING user_id`).

**Uji:**

- Argon2id dengan parameter OWASP; `needsRehash` bila parameter berbeda.
- Sandi di daftar bocor ditolak; sama dengan email ditolak.
- Sesi: tidak tersimpan mentah (kunci = SHA-256); masa diam dan mutlak; pencabutan satu, semua, dan "semua kecuali ini".
- Lockout naik bertahap lalu pulih.
- Token: dua konsumsi bersamaan, hanya satu yang berhasil (uji integrasi DB); kedaluwarsa ditolak.

- [ ] GAGAL → LULUS. Checkpoint: `feat(api): inti identitas (argon2id, sesi, lockout, token)`

### Task 5: Endpoint akun di API

**Files:** `apps/api/src/modules/auth/{auth.controller,account.controller,session.guard,csrf.guard,auth.module}.ts`, `apps/api/src/common/rate-limit.guard.ts` (kelompok `auth` dengan batas sendiri), `apps/api/test/auth/*.int.test.ts`, `docs/api/v1.md`

**Interfaces (Produces)** — semua dengan token layanan. Header `x-session-token` untuk rute sesi, `x-csrf-token` untuk mutasi bersesi:

| Metode dan path                     | Hasil                                                                                                    |
| ----------------------------------- | -------------------------------------------------------------------------------------------------------- |
| `POST /v1/auth/register`            | 202 `{status:'check_email'}`, selalu sama. Email verifikasi, atau email "Anda sudah punya akun" bila ada |
| `POST /v1/auth/login`               | 200 `{token, csrf, expiresAt}` / 401 `invalid_credentials` / 429 `locked` (`retryAfter`)                 |
| `POST /v1/auth/logout`              | 204                                                                                                      |
| `POST /v1/auth/verify-email`        | 204 / 400 `invalid_token`                                                                                |
| `POST /v1/auth/resend-verification` | 202, selalu sama (bersesi)                                                                               |
| `POST /v1/auth/forgot-password`     | 202, selalu sama                                                                                         |
| `POST /v1/auth/reset-password`      | 204 (mencabut semua sesi) / 400 `invalid_token` / 422 `weak_password`                                    |
| `GET /v1/me`                        | `MeResponse` / 401                                                                                       |
| `POST /v1/me/password`              | 204, mencabut sesi lain, email pemberitahuan                                                             |
| `GET /v1/me/sessions`               | `SessionsResponse`                                                                                       |
| `DELETE /v1/me/sessions/:id`        | 204                                                                                                      |
| `DELETE /v1/me`                     | 204, wajib sandi; hapus permanen dan cabut semua sesi                                                    |

- **Waktu seragam:** saat email tidak dikenal, login tetap menjalankan `verify` Argon2 terhadap hash tiruan. Daftar dan lupa sandi selalu mengantre satu pekerjaan email (`noop` bila tidak ada penerima), sehingga waktunya setara.
- **Rate limit kelompok `auth`:**
  - masuk 10/menit per IP klien (X-Forwarded-For dari BFF tepercaya);
  - daftar, lupa sandi, dan kirim ulang 5/jam per IP dan 5/jam per HMAC email.
- **Rekam `auth_events`:** `register`, `login_ok`, `login_fail`, `locked`, `logout`, `verify`, `reset_request`, `reset_done`, `password_change`, `session_revoke`, `account_delete`.

**Uji integrasi (Fastify `inject`, DB dan Valkey asli):**

- Jawaban daftar dan lupa sandi identik untuk email baru dan lama; selisih median waktu < 30 ms atas 20 percobaan.
- Login salah → 401 generik; email tak dikenal → 401 yang sama.
- Lockout ke-5 → 429 dengan `retryAfter`.
- Mutasi tanpa atau dengan CSRF salah → 403.
- Token reset tidak bisa dipakai dua kali; reset mencabut sesi.
- Hapus akun tanpa sandi → 401. Setelah dihapus: `/v1/me` 401, token lama tidak berlaku, event tanpa `user_id`.
- Log uji tidak memuat email atau token (logger ditangkap).

- [ ] GAGAL → LULUS. Checkpoint: `feat(api): endpoint akun dengan rate limit, csrf, dan audit`

### Task 6: Worker dan email

**Files:** `apps/api/src/worker.ts`, `apps/api/src/modules/mail/{mail.queue,mail.processor,smtp.transport,templates}.ts`, `apps/api/Dockerfile` (titik masuk worker), uji

- **Antrean `mail`:** 5 percobaan, backoff eksponensial dari 5 detik, `removeOnComplete`. Payload hanya berisi `{template, userId | to, token?}`; token tidak pernah dicatat.
- **Templat** (teks + HTML sederhana, bahasa Indonesia, tanpa gambar luar): `verify_email`, `already_registered`, `reset_password`, `password_changed`, `account_deleted`. Tautan memakai `PUBLIC_SITE_URL`.
- **Uji:**
  - unit: render templat (tautan benar, tanpa data selain yang perlu);
  - integrasi: worker mengirim ke Mailpit, pesan dibaca lewat API Mailpit;
  - SMTP mati → percobaan ulang, tanpa galat ke pengguna.

- [ ] GAGAL → LULUS. Checkpoint: `feat(api): worker email lewat antrean`

### Task 7: Web — BFF, cookie, rute akun, halaman

**Files:**

- `apps/web/src/lib/auth/{session,client,redirect}.ts`: cookie, panggilan API `no-store` dengan header sesi dan CSRF, `safeNext(ke)`.
- `apps/web/src/app/(akun)/{masuk,daftar,lupa-sandi,atur-ulang-sandi,verifikasi-email,akun}/{page,actions}.ts(x)`.
- `apps/web/src/proxy.ts`: rute akun mendapat nonce CSP, `private, no-store`, dan alih ke `/masuk` bila tanpa cookie.
- `apps/web/next.config.ts`: CSP statis tidak dipasang di rute akun.
- `components/atoms/{TextField,PasswordField}.tsx`, `components/molecules/{FormErrorSummary,AuthCard}.tsx`; item "Akun" di navigasi.

**Aturan:**

- Server Actions memvalidasi dengan skema kontrak dulu, lalu memanggil API.
- Formulir tetap bekerja **tanpa JavaScript** (progressive enhancement).
- Galat per kolom dengan `aria-describedby`; ringkasan di atas formulir mendapat fokus.
- Setelah masuk: cookie baru (rotasi) lalu alih ke `safeNext(ke)`. `safeNext` hanya menerima path yang diawali `/` tanpa `//` dan `\`.
- `atur-ulang-sandi` dan `verifikasi-email`: `Referrer-Policy: no-referrer`; token dibaca dari URL lalu dikirim lewat `POST`.
- Halaman publik tidak berubah. Item "Akun" adalah tautan statis.

**Uji unit:**

- `safeNext` (URL absolut, `//evil`, `/\evil`, encoded);
- cookie (nama dan flag sesuai ADR 0011);
- proxy (rute akun tanpa cookie → 307 ke `/masuk?ke=…`; header CSP ber-nonce; `no-store`);
- Server Action (galat kontrak tidak memanggil API);
- komponen formulir (label, galat, `autocomplete="email" / "current-password" / "new-password"`).

- [ ] GAGAL → LULUS. Checkpoint: `feat(web): halaman akun, sesi, dan csp ber-nonce`

### Task 8: Simulasi pengguna akhir dan uji keamanan (e2e)

**Files:** `tests/e2e/specs/account.spec.ts`, `account-security.spec.ts`, `support/mailpit.ts`; `support/pages.ts` (halaman akun masuk daftar axe dan lebar layar)

**Perjalanan** (360 dan 1280 px):

1. daftar → kotak masuk Mailpit → verifikasi;
2. masuk → `/akun`;
3. ganti sandi → sesi lain tercabut;
4. lupa sandi → reset → masuk dengan sandi baru;
5. lihat sesi → cabut sesi lain;
6. hapus akun → tidak bisa masuk lagi.

Semuanya juga tanpa JavaScript (formulir saja).

**Keamanan:**

- cookie dengan flag benar;
- CSP halaman akun ber-nonce tanpa `unsafe-inline` di `script-src`, konsol bersih;
- `no-store`;
- `?ke=https://evil.example` → mendarat di `/akun`;
- GET tautan verifikasi tidak memverifikasi;
- token reset kedua kali ditolak;
- daftar ulang email yang sama → pesan sama + email "sudah punya akun";
- lockout setelah 5 gagal;
- formulir mutasi dari Origin lain ditolak;
- halaman publik tetap `HIT` dari cache, tanpa `Set-Cookie`.

**Juga:** axe 0 pelanggaran di semua halaman akun, tanpa scroll horizontal di 320–1440 px, teks 200%.

- [ ] GAGAL → LULUS. Checkpoint: `test(e2e): perjalanan akun dan uji keamanan`

### Task 9: Beban login, dokumentasi, dan audit 2A

**Files:** `tests/load/auth-flood.js` (+ skenario `auth` di `loadtest.mjs`), `docs/architecture/adr/0011-sesi-dan-csp-akun.md`, `docs/security/{autentikasi,cookie-dan-privasi}.md`, `docs/api/v1.md`, `docs/testing/strategi-uji.md`, `docs/security/dependensi.md`, `CHANGELOG.md`, `docs/audits/fase-2a.md`

- [ ] **Uji beban login:** 50 pengguna × 60 detik mencoba masuk dengan sandi salah (CPU dibatasi).
  - API tetap sehat; halaman publik p95 tidak berubah berarti.
  - Mayoritas permintaan dijawab 429 setelah ambang.
  - Hash Argon2 per detik tercatat.
- [ ] `pnpm audit:all` lulus semua gerbang (termasuk Lighthouse halaman publik dan e2e akun).
- [ ] Tinjauan independen dengan Fokus tinjauan di atas, lalu perbaikan RED → GREEN.
- [ ] Laporan audit memuat tangkapan layar halaman akun (360 dan 1280 px) untuk ditinjau pemilik.
- [ ] Checkpoint: `docs: autentikasi, adr 0011, dan audit fase 2a`

## Di luar lingkup 2A

- Peringatan, notifikasi, ringkasan mingguan (2B).
- WhatsApp (2C).
- 2FA dan login sosial.
- Peran analis dan admin.
- Email dan HTTPS produksi.
