# ADR 0013 — Kanal WhatsApp dengan adapter tiruan

- Status: **Diterima** (19 Nov 2026, Fase 2C)
- Terkait: desain Fase 2 § 4 (2C), rencana `docs/plans/2026-11-19-fase-2c-whatsapp-tiruan.md` (K1–K4)

## Konteks

Prototipe meminta kabar "juga dikirim ke WhatsApp", baris kanal "Balas STOP untuk berhenti", dan status "WhatsApp terhubung". WhatsApp Business API sungguhan (akun, templat, biaya, webhook bertanda tangan) di luar lingkup capstone. Alurnya tetap harus bisa diuji ujung ke ujung secara lokal.

## Keputusan

1. **Nomor tidak disalin.**
   - Satu-satunya salinan nomor tetap di `users` (AES-256-GCM, Fase 2B).
   - `whatsapp_channels` hanya menyimpan HMAC nomor yang diverifikasi.
   - Mengubah atau menghapus nomor memutus kanal dalam transaksi yang sama, jadi nomor baru wajib diverifikasi ulang.
2. **Verifikasi dengan kode 6 digit:**
   - kode dibuat dengan `crypto.randomInt` dan disimpan hanya sebagai HMAC(AUTH_SECRET, id pengguna + kode);
   - berlaku 10 menit, 5 percobaan, perbandingan _constant-time_;
   - kirim kode maks 3 per jam per akun dan 5 per hari per nomor;
   - verifikasi tercatat `wa_verify` di `auth_events`.
3. **Antrean `whatsapp` tanpa nomor.** Job hanya membawa id pengguna dan id kabar. Worker membuka nomor tepat sebelum mengirim. Log hanya memuat jenis dan hasil.
4. **`WhatsAppSender`:**
   - satu antarmuka `send(to, text)`;
   - adapter tiruan mengirim email ke Mailpit (`wa-<digit>@wa-tiruan.invalid`, subjek "WA tiruan ke +62 812 •••• 7890"), yang berperan sebagai layar HP;
   - adapter sungguhan cukup mengganti implementasi ini.
5. **Isi dan batas** (K1, K2):
   - kabar peringatan satu evaluasi digabung jadi satu pesan, ditambah ringkasan mingguan;
   - maks 5 pesan per pengguna per hari WIB (kode dan balasan sistem tidak dihitung);
   - setiap pesan menyebut "Balas STOP untuk berhenti";
   - kabar yang terkirim ditandai `sent_whatsapp_at`, sehingga tidak terkirim dua kali dan meta kabar menulis "juga dikirim ke WhatsApp".
6. **Pesan masuk tiruan:**
   - `POST /internal/whatsapp/inbound` (token layanan) meniru webhook penyedia;
   - `pnpm wa:balas <nomor> STOP` untuk mencoba;
   - STOP menghentikan kanal dan mengirim konfirmasi;
   - teks lain dari nomor terhubung dijawab bantuan;
   - nomor tak dikenal tidak dijawab, dan jawaban HTTP selalu sama.
7. **Setelah STOP** (K3): aktif lagi hanya lewat aplikasi dengan verifikasi ulang (persetujuan eksplisit, tercatat).
8. **Rotasi kunci nomor** (Bagian 0): `phone_key_id` + `PHONE_ENC_KEY_PREVIOUS`; pencarian pesan masuk mencoba kedua kunci.

## Konsekuensi

- Adapter sungguhan nanti wajib memverifikasi tanda tangan webhook penyedia, mengganti token layanan.
- Catatan pengiriman (`whatsapp_messages`, tanpa isi dan tanpa nomor) disimpan 30 hari untuk batas pengiriman.
