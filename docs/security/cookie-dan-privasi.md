# Cookie dan Privasi

Halaman publik Kawan Pasar tidak memakai akun, analitik, atau pelacak pihak ketiga. Pengunjung tanpa akun hanya mendapat satu cookie fungsional; pengguna yang masuk mendapat cookie sesi.

| Cookie         | Nilai | Umur  | Atribut                                   | Tujuan                                                                    |
| -------------- | ----- | ----- | ----------------------------------------- | ------------------------------------------------------------------------- |
| `kp_onboarded` | `1`   | 1 thn | `Path=/; SameSite=Lax` (+ `Secure` https) | Mengarahkan pengunjung yang pernah melewati orientasi langsung ke Beranda |

- Dipasang di browser oleh `MarkOnboarded` (`apps/web/src/components/organisms/MarkOnboarded.tsx`) saat pengunjung membuka halaman selain `/`.
- Dibaca hanya oleh `apps/web/src/proxy.ts` untuk alamat `/`.
- Tidak berisi atau terhubung ke identitas apa pun, tidak dikirim ke API, dan tidak disimpan di server. Cookie ini murni fungsional, jadi tidak memerlukan persetujuan sebagai data pribadi (UU PDP No. 27/2022). Menghapusnya hanya membuat halaman orientasi tampil lagi.
- Halaman tetap statis dan dapat di-cache. Pengalihan terjadi di proxy, bukan di halaman.

## Cookie sesi (Fase 2A)

| Cookie              | Nilai              | Umur                                 | Atribut                                                | Tujuan     |
| ------------------- | ------------------ | ------------------------------------ | ------------------------------------------------------ | ---------- |
| `__Host-kp_session` | Token acak 32 byte | sampai 30 hari (server: 7 hari diam) | `Path=/; Secure; HttpOnly; SameSite=Lax`, tanpa Domain | Sesi masuk |

- Dipasang dan dihapus hanya oleh Server Actions di `apps/web/src/lib/auth/actions.ts`. Penghapusan mengulang semua atribut, karena browser mengabaikan penghapusan cookie `__Host-` tanpa `Secure` (ditemukan di uji e2e Fase 2A).
- API hanya menyimpan SHA-256 token (ADR 0011). Halaman publik tidak membaca cookie ini dan tetap di-cache bersama.

## Data akun dan hak pengguna

Ringkasan untuk pengguna ada di halaman `/privasi`. Rinciannya:

- **Yang disimpan:** email, hash Argon2id, sesi (sidik token, jenis peramban/OS, waktu), dan catatan keamanan 90 hari tanpa email dengan IP sebagai HMAC harian.
- **Hapus akun:** dari `/akun`, permanen. Token dan sesi ikut terhapus; catatan keamanan kehilangan `user_id`.
- Lihat `docs/security/autentikasi.md`.

## Data peringatan (Fase 2B)

- Tidak ada cookie baru. Halaman Peringatan adalah halaman akun (privat, tidak di-cache).
- Kabar di aplikasi disimpan **180 hari**, lalu dihapus otomatis oleh worker (retensi harian). Pantauan dan pengaturan dihapus bersama akun.
- Nomor HP (opsional) disimpan terenkripsi dan hanya ditampilkan tersamar (`/privasi`).
- Email ringkasan mingguan hanya memuat harga dan perubahan komoditas yang dipantau, tanpa data pribadi lain, dan tautan berhenti berlangganan satu klik.

## WhatsApp (Fase 2C)

- Nomor dipakai untuk WhatsApp hanya setelah verifikasi kode. STOP menghentikan; aktif lagi hanya dengan verifikasi ulang di aplikasi.
- Paling banyak 5 pesan kabar/ringkasan per hari.
- Antrean dan log tidak memuat nomor maupun isi pesan.
- Catatan pengiriman (tanpa isi, tanpa nomor) disimpan 30 hari.

## Mode Analis (Fase 3A)

- Grafik perbandingan di `/analis` terbuka untuk semua pengunjung tanpa cookie tambahan. Gambar PNG dibuat di peramban.
- Pengajuan peran Analis menyimpan alasan (10–500 karakter) dan instansi (opsional). Keduanya terhapus bersama akun.
- Setiap unduhan CSV dicatat di `audit_log` dengan id akun, jenis berkas, dan jumlah baris, tanpa email atau filter yang dipakai. Catatan ini disimpan 1 tahun.
- CSV hanya berisi data harga pasar dan prediksi, tidak ada data pengguna.

## Admin dan gambar artikel (Fase 3B)

- Admin melihat email pengguna hanya tersamar (`s***@contoh.id`), dan hanya dengan mencari alamat lengkapnya.
- Setiap tindakan admin tercatat di `audit_log` (hanya id), disimpan 1 tahun.
- Gambar di artikel dapat dimuat langsung dari `upload.wikimedia.org`, `images.unsplash.com`, atau domain tim (`ARTICLE_IMAGE_ORIGINS`). Situs itu dapat melihat alamat IP pembaca, tetapi tidak menerima alamat halaman (tanpa referrer) atau cookie Kawan Pasar.
