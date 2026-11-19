# Rencana Fase 2C — WhatsApp (Adapter Tiruan)

- Tanggal: 19 November 2026
- Status: **selesai 19 Nov 2026** (audit: docs/audits/fase-2c.md); **disetujui pemilik 19 Nov 2026** (K1 peringatan + ringkasan mingguan, K2 5/hari digabung, K3 aktif lagi lewat aplikasi + verifikasi ulang, K4 sisa 2B dikerjakan)
- Desain induk: [`docs/design/2026-11-17-fase-2-akun-dan-peringatan-design.md`](../design/2026-11-17-fase-2-akun-dan-peringatan-design.md) § 4 (2C)
- Prototipe:
  - `d_peringatan`: baris kanal WhatsApp "Pesan singkat ke 08xx… Balas STOP untuk berhenti", contoh gelembung pesan, kabar "juga dikirim ke WhatsApp";
  - `p10_states`: status "WhatsApp terhubung".

## 1. Tujuan

Pengguna terverifikasi bisa:

- menghubungkan nomor HP-nya ke WhatsApp dengan kode 6 digit;
- menerima kabar peringatan lewat WhatsApp;
- berhenti dengan membalas **STOP**.

Pengiriman sungguhan (WhatsApp Business API) di luar lingkup. Di lokal, adapter tiruan menaruh setiap pesan WA sebagai email di Mailpit, yang berfungsi sebagai "layar HP".

## 2. Bagian 0 — Sisa dari 2B (dikerjakan dulu, karena WhatsApp memakai nomor HP)

| #   | Perubahan                                                                                                                                                                                                        |
| --- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 01  | **Versi kunci nomor HP:** kolom `phone_key_id` dan dukungan kunci lama (`PHONE_ENC_KEY_PREVIOUS`, opsional) untuk rotasi. Dekripsi gagal dicatat sebagai hitungan, tanpa nomor. Ini menutup Minor 8 tinjauan 2B. |
| 02  | **Batas 20 pantauan atomik:** hitung dan sisipkan dalam satu transaksi dengan kunci per pengguna (`pg_advisory_xact_lock`). Menutup Minor 7.                                                                     |
| 03  | **`model-export`:** masukan dipasang baca-saja (`.input`), keluaran di folder tersendiri. Menutup Minor 11.                                                                                                      |

## 3. Data (migrasi `0008_whatsapp.sql`)

- **`whatsapp_channels`** (satu baris per pengguna, cascade):
  - `status` `pending|verified|stopped`;
  - `phone_hmac`: nomor yang diverifikasi. Bila nomor di akun berubah atau dihapus, kanal kembali ke `pending`;
  - `code_hash` (HMAC kode + id pengguna), `code_expires_at` (10 menit), `code_attempts` (maks 5), `code_sent_at`;
  - `verified_at`, `stopped_at`, `updated_at`.
- **Nomor tidak disalin.** Satu-satunya salinan tetap di `users` (terenkripsi), dan kanal hanya menyimpan HMAC-nya. Pencarian pesan masuk (STOP) memakai HMAC itu.
- `alert_preferences.whatsapp` (bawaan nyala, berlaku bila kanal `verified`).
- `notifications.sent_whatsapp_at`, supaya meta kabar bisa menampilkan "juga dikirim ke WhatsApp".
- Enum `auth_event_type` ditambah `wa_verify` dan `wa_stop`.

## 4. Alur

1. **Hubungkan** (`/peringatan`, baris WhatsApp):
   - tanpa nomor HP → tautan ke `/akun`;
   - dengan nomor → tombol "Kirim kode" → kode 6 digit (`crypto.randomInt`) dikirim lewat WA tiruan → isian kode → `verified` → panel "WhatsApp terhubung".
2. **Pembatasan:**
   - kode berlaku 10 menit, 5 percobaan, lalu wajib minta baru;
   - kirim kode maks 3 per jam per akun dan 5 per hari per nomor (HMAC);
   - perbandingan _constant-time_;
   - jawaban salah tidak membedakan "kedaluwarsa" dan "salah" kecuali saat percobaan habis.
3. **Kirim kabar:**
   - setelah evaluasi, kabar baru milik pengguna dengan kanal `verified` dan sakelar WhatsApp nyala dimasukkan ke antrean `whatsapp`, **satu pesan per pengguna per evaluasi**, dengan batas harian (keputusan K2);
   - pesan mengikuti gelembung prototipe: "Kawan Pasar 🌶️", judul, isi, dan "Lihat detail → <situs>/<tautan>".
4. **Antrean `whatsapp`:**
   - job hanya berisi id pengguna dan id kabar, **bukan nomor**;
   - worker membuka nomor saat mengirim, dan antrean serta log tidak pernah memuat nomor.
5. **`WhatsAppSender`:**
   - antarmuka `send(to, text)`;
   - adapter tiruan mengirim email ke Mailpit dengan subjek "WA tiruan ke +62 812 •••• 7890".
6. **Pesan masuk tiruan:**
   - `POST /internal/whatsapp/inbound {from, text}` dengan token layanan, meniru webhook penyedia;
   - `pnpm wa:balas <nomor> STOP` untuk mencoba;
   - "STOP" (tanpa beda huruf besar/kecil, spasi diabaikan) → `stopped` + pesan konfirmasi; teks lain diabaikan dengan jawaban bantuan singkat.
7. **Berhenti / ubah nomor / hapus akun:**
   - kanal berhenti atau terhapus;
   - ringkasan mingguan tidak terpengaruh (tetap aplikasi + email).

## 5. API (`/v1`, sesi + CSRF untuk perubahan)

- `GET /v1/whatsapp` → `{status, phone (tersamar), canSend}`.
- `POST /v1/whatsapp/code` → mengirim kode.
- `POST /v1/whatsapp/verify {code}`.
- `DELETE /v1/whatsapp` → memutus dari aplikasi.
- `PUT /v1/alerts/preferences` ditambah `whatsapp`.

## 6. Web

- Baris WhatsApp di `/peringatan` menjadi nyata: status, kirim kode, isian kode (`inputMode=numeric`, `autocomplete=one-time-code`), putuskan, dan sakelar.
- Panel "WhatsApp terhubung" (StatePanel, pose Senang) setelah verifikasi.
- Meta kabar menyebut "juga dikirim ke WhatsApp" bila terkirim.
- `/privasi` diperbarui: nomor dipakai untuk WhatsApp hanya setelah verifikasi; STOP menghentikan.

## 7. Uji

- **Unit:** pembuatan dan hash kode, normalisasi "STOP", format pesan, penggabungan kabar.
- **Integrasi:**
  - verifikasi (benar, salah, kedaluwarsa, 5 percobaan, batas kirim);
  - IDOR;
  - nomor berubah → kanal kembali `pending`;
  - STOP lewat pesan masuk (nomor tak dikenal → diam);
  - antrean dan log tanpa nomor;
  - batas harian.
- **Worker:** kabar → job → adapter tiruan → email di Mailpit.
- **E2E:**
  - hubungkan WhatsApp (kode dibaca dari Mailpit) → "WhatsApp terhubung";
  - impor harga → kabar di aplikasi + pesan WA di Mailpit;
  - `wa:balas STOP` → status berhenti;
  - tanpa JS; axe di 360 dan 1280 px.

## 8. Dokumen

- ADR 0013 (adapter WhatsApp, pesan masuk tiruan, nomor tidak disalin).
- `docs/api/v1.md`, `kamus-data.md`, `autentikasi.md`, `cookie-dan-privasi.md`, `menjalankan-lokal.md` (`wa:balas`), CHANGELOG, dan audit `fase-2c.md`.

## 9. Keputusan yang dibutuhkan dari pemilik

- **K1 — Isi WhatsApp:** hanya kabar peringatan (usul), atau peringatan + ringkasan mingguan.
- **K2 — Batas pesan:** maks 5 pesan WA per pengguna per hari, kabar satu evaluasi digabung jadi satu pesan (usul); atau tanpa batas.
- **K3 — Setelah STOP:** aktif lagi hanya lewat aplikasi dengan verifikasi ulang (usul, persetujuan eksplisit); atau membalas "MULAI".
- **K4 — Sisa 2B (Bagian 0):** dikerjakan di fase ini (usul); atau ditunda.

### Keputusan pemilik (19 Nov 2026)

- **K1:** WhatsApp mengirim kabar peringatan **dan** ringkasan mingguan (bila sakelar mingguan nyala). Ringkasan WA tidak memuat tautan berhenti-email; berhenti WA lewat STOP.
- **K2:** maks 5 pesan WA per pengguna per hari; kabar satu evaluasi digabung jadi satu pesan. Ringkasan mingguan dihitung dalam batas ini.
- **K3:** sesudah STOP, aktif lagi hanya lewat aplikasi dengan verifikasi ulang.
- **K4:** Bagian 0 (sisa 2B) dikerjakan lebih dulu.
