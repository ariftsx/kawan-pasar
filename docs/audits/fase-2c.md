# Audit Fase 2C — WhatsApp (Adapter Tiruan)

- Tanggal: 19 November 2026
- Rencana: [`docs/plans/2026-11-19-fase-2c-whatsapp-tiruan.md`](../plans/2026-11-19-fase-2c-whatsapp-tiruan.md) (K1–K4 diputuskan pemilik)
- ADR baru: [0013 — Kanal WhatsApp dengan adapter tiruan](../architecture/adr/0013-whatsapp-tiruan.md)
- Status: **20/20 gerbang lulus** (§ 2: satu gerbang diulang)

## 1. Yang dihasilkan

| Bagian      | Hasil                                                                                                                                                                                                                                                                                                                        |
| ----------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 0 — Sisa 2B | Rotasi kunci nomor HP (`phone_key_id`, `PHONE_ENC_KEY_PREVIOUS`, segel ulang saat dibaca), batas 20 pantauan atomik, `model-export` dengan masukan baca-saja dan keluaran di folder sendiri                                                                                                                                  |
| WhatsApp    | Hubungkan nomor dengan kode 6 digit, status "Peringatan WhatsApp aktif!", kabar (digabung per evaluasi) + ringkasan mingguan ke WhatsApp maks 5/hari, STOP untuk berhenti, aktif lagi lewat verifikasi ulang, "juga dikirim ke WhatsApp" di kabar. Pesan tampil di Mailpit; `pnpm wa:balas <nomor> <teks>` meniru balasan HP |

## 2. Gerbang mutu (`COMPOSE_PARALLEL_LIMIT=1 pnpm audit:all`)

| Gerbang                                                                                                                                                                                                               | Hasil                                                                                                                                                                                                              |
| --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| format, lint, typecheck, unit-tests, web-build, stack-rebuild, infra (40), e2e-smoke, lighthouse, test-db-reset, ingest (pytest, mypy, ruff), model (pytest, mypy, ruff), dependency-audit, no-any, no-ai-attribution | ✔                                                                                                                                                                                                                  |
| integration-tests                                                                                                                                                                                                     | ✔ diulang. Pada audit, 2 uji worker email (Fase 2A, kode tidak berubah) gagal karena Mailpit tidak memberi salam SMTP dalam batas waktu. Saat itu RAM host bebas ±1 GB. Diulang dengan perintah yang sama: 204/204 |

Build image kini berurutan (`COMPOSE_PARALLEL_LIMIT=1`). Docker Desktop sempat mati dua kali saat membangun empat image sekaligus.

| Paket      | Uji                                                                                                                          |
| ---------- | ---------------------------------------------------------------------------------------------------------------------------- |
| api        | 305 (unit + integrasi). Baru: verifikasi WA, batas paralel, STOP, IDOR, pengiriman semua-atau-tidak, rotasi kunci, penyapuan |
| web        | 227 unit + 2 integrasi                                                                                                       |
| contracts  | 43                                                                                                                           |
| e2e        | lulus di audit, termasuk WhatsApp (hubungkan di 360/1280 px dengan axe, kode salah, kabar → pesan WA → STOP)                 |
| Lighthouse | 7 halaman publik dalam anggaran                                                                                              |

## 3. Simulasi pengguna akhir

| Perjalanan                                                                                                          | Hasil |
| ------------------------------------------------------------------------------------------------------------------- | ----- |
| Akun tanpa nomor → panel WA mengarahkan ke `/akun`                                                                  | ✔     |
| Kirim kode → kode di "HP" (Mailpit) → masukkan → "Peringatan WhatsApp aktif!" → sakelar WhatsApp tampil             | ✔     |
| Kode salah → "Kode salah"; 5 percobaan → kode hangus                                                                | ✔     |
| Pantau bawang > Rp 39.000 → impor harga → kabar di aplikasi "juga dikirim ke WhatsApp" + pesan WA bergaya prototipe | ✔     |
| `wa:balas … STOP` → konfirmasi di HP → status "Dihentikan…" → aktif lagi hanya dengan kode baru                     | ✔     |
| Ubah nomor di `/akun` → WhatsApp terputus                                                                           | ✔     |

## 4. Tinjauan independen (baca-saja)

- **Critical:** tidak ada.
- **Important (7, semua diperbaiki, masing-masing dengan uji yang gagal dulu):**
  1. Batas 5 percobaan kode bisa dilewati permintaan paralel. Kini percobaan dipesan secara atomik sebelum dibandingkan.
  2. Batas kirim kode TOCTOU. Kini dicek dan dicatat dalam satu transaksi berkunci.
  3. Segel ulang nomor bisa menimpa nomor yang baru diganti. Kini bersyarat pada nonce yang dibaca.
  4. Rotasi kunci memutus kanal WA. HMAC kanal kini ikut dipindah.
  5. Antrean WA yang gagal bisa membuat email mingguan terkirim dua kali atau kabar WA hilang. Kini kanal saling bebas, dan kabar yang belum terkirim disapu setiap evaluasi.
  6. Kirim WA bisa ganda atau melewati batas harian. Kini satu transaksi berkunci: klaim, catat, kirim.
  7. Penyimpangan yang tidak tercatat. Kini tercatat: WA menyalin kabar aplikasi, jadi membutuhkan notifikasi aplikasi menyala (dijelaskan di UI); baris 2B mencoba kedua kunci.
- **Minor diperbaiki:** galat SMTP tidak lagi memuat nomor; teks status saat sakelar WA mati.
- **Ditunda (dicatat di buku catatan):**
  - kabar di atas batas harian tidak dikirim ulang esoknya;
  - webhook tiruan cukup dengan token layanan (adapter sungguhan wajib verifikasi tanda tangan);
  - catatan kirim lama tidak dihitung setelah kunci lama dibuang.

## 5. Keputusan pelaksanaan

Lihat buku catatan (W-1…W-7). Ringkasnya:

- Nomor tidak disalin; kanal menyimpan HMAC saja; ubah nomor = putus.
- Kode dicatat saat diantrekan.
- Batas harian per hari WIB untuk kabar dan ringkasan (kode dan balasan sistem tidak dihitung).
- Email tiruan memuat nomor di alamat penerima, hanya di Mailpit lokal.

## 6. Tangkapan layar

| Layar                                          | Berkas                                                                                                 |
| ---------------------------------------------- | ------------------------------------------------------------------------------------------------------ |
| Panel WhatsApp belum terhubung / kode terkirim | [wa-belum-terhubung](fase-2c/wa-belum-terhubung.png), [wa-kode-terkirim](fase-2c/wa-kode-terkirim.png) |
| Peringatan, WhatsApp terhubung (1280 px)       | [peringatan-terhubung-1280](fase-2c/peringatan-terhubung-1280.png)                                     |
| Kabar "juga dikirim ke WhatsApp" (360 px)      | [peringatan-kabar-wa-360](fase-2c/peringatan-kabar-wa-360.png)                                         |
| Pesan WA tiruan di Mailpit ("layar HP")        | [mailpit-pesan-wa-360](fase-2c/mailpit-pesan-wa-360.png)                                               |

## 7. Catatan untuk pemilik

1. Dengan 2C, **Fase 2 lengkap** (akun, peringatan, notifikasi, ringkasan mingguan, WhatsApp tiruan). Fase berikutnya menurut desain: peran analis dan admin (Fase 3).
2. Adapter WhatsApp Business sungguhan cukup mengganti `WhatsAppSender` dan webhook masuk, dengan verifikasi tanda tangan penyedia.
3. Laptop: RAM bebas sering di bawah 1,5 GB selama uji. Menutup aplikasi berat saat audit mengurangi kegagalan Docker dan uji yang _flaky_.
4. Masih terbuka:
   - Tabel 4.5 laporan v04;
   - tanggal SKB hari raya 2027;
   - 5 draf artikel;
   - `PUBLIC_SITE_URL` produksi (https).
