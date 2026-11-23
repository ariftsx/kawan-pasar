# Desain Fase 3 — Mode Analis dan Admin

- Tanggal: 19 November 2026
- Status: **disetujui pemilik 19 Nov 2026**
- Induk: `docs/design/2026-11-11-kawan-pasar-design.md` (tahap 3: Mode Analis unduh CSV/PNG; Admin: persetujuan peran, pemantauan ingest/artefak, konten)
- Prototipe: `d_analis` (Mode Analis, desktop). Admin tidak ada di prototipe; saya rancang dari sistem desain (seperti layar akun di 2A).

## 1. Keputusan pemilik (19 Nov 2026)

| #   | Keputusan                                                                                                                                                          |
| --- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| P1  | Mode Analis **dilihat publik**. **Unduh CSV** (seluruh riwayat) hanya untuk akun berperan **Analis**, yang diajukan pengguna dan disetujui admin.                  |
| P2  | Admin dilindungi **konfirmasi ulang sandi** untuk aksi sensitif, sesi admin lebih pendek, dan semua aksi tercatat di `audit_log`. **Tanpa 2FA** (ditunda).         |
| P3  | Dua sub-fase: **3A Mode Analis** (+ pengajuan peran), **3B Admin**. Admin pertama dibuat lewat CLI di server (`pnpm admin:grant <email>`), tidak pernah lewat web. |
| P4  | Konten: **editor markdown di web** untuk artikel.                                                                                                                  |

### Risiko yang diterima dan mitigasinya

- **Admin tanpa 2FA (P2).** Satu sandi admin yang bocor berarti akses admin penuh. Mitigasi:
  - sesi admin diam 2 jam / mutlak 12 jam;
  - konfirmasi sandi (sekali per 10 menit) sebelum menyetujui peran, mengubah, menerbitkan, atau menarik artikel;
  - lockout dan rate limit akun berlaku seperti biasa;
  - setiap aksi admin tercatat di `audit_log`, tanpa isi pribadi;
  - email pemberitahuan ke admin saat ada masuk baru.
  - Tabel dirancang supaya TOTP bisa ditambahkan nanti.
- **Editor markdown di web (P4).** Mitigasi:
  - markdown dirender di server dengan `react-markdown` + `skipHtml` (HTML mentah tidak pernah tampil, sama seperti sekarang), tanpa `rehype-raw`;
  - tautan hanya `https:` atau path internal, dan gambar hanya dari daftar asal yang diizinkan;
  - batas ukuran 50 KB per artikel;
  - setiap simpan menjadi revisi (`article_revisions`), jadi isi lama bisa dipulihkan;
  - pratinjau memakai perender yang sama dengan halaman publik;
  - halaman admin memakai CSP ber-nonce dan `private, no-store`.

## 2. 3A — Mode Analis

- **Halaman `/analis`** (publik, statis + ISR, data sama dengan halaman publik, prototipe `d_analis`):
  - filter pasar (Kramat Jati; pasar lain "segera"), komoditas (chip pilih-banyak), rentang (90H / 1T / 3T / Semua), dan metrik (indeks = 100 di awal rentang / harga Rp / perubahan %);
  - grafik perbandingan dan tabel prediksi per horizon (ARIF-Net, status uji);
  - kartu "memakai data yang sama dengan halaman publik".
- **Interaksi tanpa membuat halaman dinamis:**
  - server menyematkan seri ketiga komoditas sekali (harian untuk ≤ 1 tahun, mingguan untuk 3T/Semua; ±20 KB terkompresi);
  - komponen klien kecil hanya mengganti pilihan; tanpa JavaScript tampil tampilan bawaan (3 komoditas, 1T, indeks);
  - anggaran JS halaman ini dicatat sendiri (desktop).
- **Unduh grafik PNG** di browser (SVG → canvas), tanpa server. Terbuka untuk semua, karena isinya sama dengan yang terlihat.
- **Unduh CSV** (peran Analis):
  - Route Handler BFF → `GET /v1/analyst/prices.csv` (sesi + peran, dicek dari DB setiap permintaan, jadi pencabutan berlaku seketika);
  - isi: pasar, komoditas, tanggal, harga, sumber; berkas kedua untuk prediksi bundel aktif, dengan versi model dan status uji;
  - batas 30 unduhan per jam per akun;
  - setiap unduhan tercatat di `audit_log`;
  - sel CSV di-escape terhadap injeksi formula.
- **Pengajuan peran Analis** (di `/analis` dan `/akun`):
  - formulir alasan (≤ 500 karakter) dan instansi (opsional), hanya untuk akun dengan email terverifikasi;
  - status: menunggu / disetujui / ditolak, dengan alasan penolakan;
  - satu pengajuan aktif per akun.
  - Sampai 3B selesai, persetujuan lewat CLI (`pnpm role:grant <email> analyst`).
- **Data:**
  - enum `user_role` ditambah `analyst` dan `admin`;
  - tabel `analyst_requests` (pengguna, alasan, instansi, status, diputuskan_oleh, diputuskan_pada, catatan);
  - tabel `audit_log` (pelaku, aksi, sasaran, waktu; tanpa isi pribadi; disimpan 1 tahun).
- **Mobile:** `/analis` tetap bisa dibuka (grafik menyesuaikan lebar), dengan catatan "lebih nyaman di desktop". Tautan di Lainnya berubah dari "segera" menjadi aktif.

## 3. 3B — Admin

- **`/admin`** (peran admin, CSP ber-nonce, `private, no-store`, tidak diindeks):
  - **Pengajuan peran:** daftar menunggu, setujui atau tolak dengan catatan; pengguna diberi tahu lewat kabar dan email.
  - **Pengguna:** cari berdasarkan email (hasil tersamar), lihat peran, cabut peran Analis.
  - **Pemantauan:**
    - `ingest_runs` terakhir (status, baris, galat);
    - bundel prediksi (aktif/ditolak dan alasannya, umur);
    - antrean (email, peringatan, WhatsApp: menunggu/gagal), tanpa isi job.
  - **Artikel:** daftar draf/terbit, editor markdown dengan pratinjau, terbitkan atau tarik, riwayat revisi dan pulihkan.
- **Keamanan:**
  - konfirmasi ulang sandi;
  - sesi admin pendek;
  - `audit_log` untuk setiap aksi;
  - admin tidak bisa mengubah perannya sendiri;
  - peran admin hanya lewat CLI.

## 4. Di luar lingkup Fase 3

- 2FA (TOTP), SSO, dan peran granular selain user/analyst/admin.
- Unggah gambar untuk artikel (gambar hanya lewat URL dari asal yang diizinkan).
- Adapter PIHPS (Fase 4).
