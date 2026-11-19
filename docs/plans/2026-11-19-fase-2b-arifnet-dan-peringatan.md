# Rencana Fase 2B — Tindak Lanjut Akun, ARIF-Net, dan Peringatan

- Tanggal: 19 November 2026
- Status: **selesai 19 Nov 2026** (audit: docs/audits/fase-2b.md); **disetujui pemilik 19 Nov 2026** (K1 (b) perkiraan Hijriah + catatan, K2 usul diterima, K3 kontainer `model-export`)
- Desain induk: [`docs/design/2026-11-17-fase-2-akun-dan-peringatan-design.md`](../design/2026-11-17-fase-2-akun-dan-peringatan-design.md) § 4
- Masukan pemilik (19 Nov):
  - nomor HP opsional saat daftar;
  - konfirmasi kata sandi saat daftar;
  - tombol lihat/sembunyikan di semua isian kata sandi;
  - pengecualian advisory `picomatch` dengan alasan tercatat;
  - ARIF-Net (folder `D:\.Capstone dan TA\ARIF-Net`) dipakai di produk bila layak.

Fase ini dikerjakan dalam tiga bagian berurutan. Setiap bagian ditutup dengan uji yang lulus sebelum bagian berikutnya dimulai. Audit, simulasi pengguna, dan tinjauan independen dilakukan sekali di akhir.

## 1. Penilaian kelayakan ARIF-Net (sudah dilakukan, baca-saja)

### Yang diperiksa

| Hal                | Temuan                                                                                                                                                                                                                                                                    |
| ------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Pipeline           | Semua 47 tahap `run_all` selesai (10–17 Nov 2026). Retraining final A0 sudah ada: `results/models/arifnet/arifnet_s0..s4.pt` (5 seed, @ 45 KB) + `model_card.json`.                                                                                                       |
| Integritas         | SHA-256 kelima bobot dan snapshot data latih cocok dengan `model_card.json`.                                                                                                                                                                                              |
| Data               | Harga PIHPS ARIF-Net (`data/processed/pihps/prices_combined.csv`) **identik byte per byte** dengan seed produk `data/seed/prices_combined.csv`. Data latih berakhir 30 Sep 2026.                                                                                          |
| Masukan model      | A0 hanya memakai harga + kalender (bukan berita/iklim/BBM). Inferensi di produk tidak membutuhkan data berita.                                                                                                                                                            |
| Uji coba inferensi | Skrip di luar repo memuat 5 seed dan menghasilkan 24 baris (3 komoditas × 8 horizon) dari tanggal dasar 30 Sep 2026: kuantil monoton, seed sepakat (simpangan median ≤ 0,03). Fitur yang dibangun ulang **identik** dengan pipeline ARIF-Net (24 baris × 52 kolom diuji). |
| Lisensi            | MIT, © 2026 Muhamad Nur Arif.                                                                                                                                                                                                                                             |

### Akurasi validasi (relMAE terhadap "harga tetap", rata-rata F1–F2 × 5 seed; < 1 = lebih baik)

| Komoditas            | h1    | h3    | h7    | h14   | h30   | h90   | h180  | h365  |
| -------------------- | ----- | ----- | ----- | ----- | ----- | ----- | ----- | ----- |
| Bawang merah         | 1,001 | 0,995 | 0,976 | 0,926 | 0,880 | 0,790 | 0,674 | 0,867 |
| Cabai merah keriting | 1,009 | 1,001 | 0,984 | 0,950 | 0,885 | 0,747 | 0,735 | 0,784 |
| Beras medium I       | 1,000 | 1,002 | 1,016 | 1,036 | 0,997 | 1,028 | 1,094 | 0,978 |

Ringkasan: relMAE gabungan A0 = **0,850** (rata-rata F1–F2 × 5 seed; pembanding terbaik BiLSTM 0,863). Angka 0,933 yang semula tertulis di sini adalah rata-rata per sel dari laporan analisis celah, metrik lain; dikoreksi 19 Nov saat pelaksanaan. Dua varian ablation (X-1 0,841, C-4 0,845) sedikit lebih rendah di validasi, tetapi protokol membekukan A0 sebelum uji.

### Kesimpulan: **layak dipakai, dengan tiga keterangan wajib di produk**

1. **Uji prospektif buta belum dibuka.** Pembukaan dijadwalkan sesudah 30 Nov 2026 (protokol v1.1.0), jadi angka di atas adalah skor validasi, bukan uji akhir.
2. **Horizon pendek (1–7 hari) setara "harga tetap".** Itu sifat data: 69–96% perubahan harian bernilai nol. Model biasanya memprediksi "stabil" dengan rentang kemungkinan.
3. **Beras medium I tidak lebih akurat dari "harga tetap"** di hampir semua horizon. Prediksinya hampir selalu "stabil" dengan rentang sempit.

Sebelum dipakai ada satu kekurangan data: **kalender hari raya 2027 belum ada** di `configs/calendar_holidays.json`. Prediksi 180 dan 365 hari dari 30 Sep 2026 menjangkau Ramadan dan Idulfitri 2027 (§ 6, keputusan K1).

## 2. Bagian A — Tindak lanjut akun 2A

| #   | Perubahan                                                                                                                                                                                                                                                                                                                                                                                                                                                          |
| --- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| A1  | **Nomor HP opsional** di `/daftar` dan di `/akun` (ubah/hapus). Dinormalisasi ke E.164 Indonesia (`08…`, `+62…`, `62…` → `+628…`, 10–13 digit nasional). Disimpan **terenkripsi** (AES-256-GCM, kunci `PHONE_ENC_KEY` dari env, kolom `phone_nonce` + `phone_ciphertext`) beserta HMAC untuk pencarian. Belum diverifikasi; verifikasi nomor dan kirim WhatsApp tetap di 2C, yang memakai skema yang sama. Tidak pernah dicatat di log, dan `/privasi` diperbarui. |
| A2  | **Konfirmasi kata sandi** di `/daftar` dan `/atur-ulang-sandi`, serta di "ganti sandi" (sandi baru). Diperiksa di server (Server Action) dan di kontrak; pesan "Kedua kata sandi tidak sama." Tetap tanpa JavaScript.                                                                                                                                                                                                                                              |
| A3  | **Tombol lihat/sembunyikan** di semua isian kata sandi: masuk, daftar (dua isian), atur ulang, ganti (sandi lama dan baru), hapus akun. Tombol ikon mata dengan `aria-pressed` dan label "Tampilkan kata sandi"/"Sembunyikan kata sandi", target sentuh 44 px. Ini peningkatan progresif: tanpa JS isian tetap tersembunyi. Komponen klien kecil, tunduk anggaran JS dan CSP ber-nonce.                                                                            |
| A4  | **Pengecualian advisory `picomatch` GHSA-fc5q-39xc-vjpf** di `auditConfig.ignoreGhsas` (`pnpm-workspace.yaml`) dengan alasan di `docs/security/dependensi.md`. `scripts/audit.mjs` memeriksa setiap kali apakah versi perbaikan sudah rilis, dan menggagalkan gerbang bila pengecualian sudah tidak diperlukan.                                                                                                                                                    |

Migrasi `0006_user_phone.sql`. Uji: unit normalisasi dan enkripsi (vektor uji, nonce unik, tamper → gagal), integrasi API (daftar dengan/tanpa HP, HP tidak valid, sandi tidak sama), e2e (tombol mata dengan dan tanpa JS, axe), serta pemeriksaan log tanpa nomor HP.

## 3. Bagian B — ARIF-Net di produk

### Bentuk penerapan

Jalur bundel yang sudah ada (ADR 0006, kontrak bundel v1) tidak diubah. ARIF-Net menghasilkan bundel `model_name = arif-net`, lalu `promoteBundle` memverifikasinya. Endpoint sudah memilih bundel non-demo lebih dulu, sehingga bundel demo tergeser **tanpa perubahan kode API**.

| Komponen                                      | Isi                                                                                                                                                                                                                                                                                                                                                                         |
| --------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `services/model-arifnet/` (Python 3.12)       | Paket `kp_model`: hanya **inferensi**, tanpa pelatihan. Berisi salinan arsitektur A0 (`model.py`), fitur harga + kalender + drift, median/kuantil campuran, dan eksportir bundel. Dijaga uji kesetaraan: fitur dan prediksi harus sama dengan keluaran pipeline ARIF-Net pada contoh beku.                                                                                  |
| Artefak model `services/model-arifnet/model/` | Lima bobot dikonversi dari `.pt` (pickle) ke **`.npz` tanpa pickle** (pelaksanaan: setara safetensors untuk tujuan ini, tanpa dependensi tambahan) + `model.json` (konfigurasi, σ, dimensi, statistik praproses, sha256 sumber). Pemuatan tidak pernah memakai pickle, jadi tidak ada eksekusi kode dari berkas bobot. Model card disalin, dengan atribusi dan lisensi MIT. |
| Eksportir                                     | `python -m kp_model.export --prices data/seed/prices_combined.csv --out services/model-arifnet/artifacts/` menulis `metadata.json` (`model_version = arifnet-a0-v1.1.0+<sha bobot>`, `data_version = pihps-<tanggal akhir>-<sha>`, `preprocess_version = arifnet-features-v1.1.0`), `forecasts.csv`, dan `SHA256SUMS`, lalu `pnpm bundle:promote`.                          |
| Eksekusi                                      | Kontainer sekali jalan `model-export` (profil compose `model`, torch CPU dipin). Tidak ada port, jaringan `backend` saja, sistem berkas baca-saja kecuali `artifacts/`.                                                                                                                                                                                                     |
| `eval_status`                                 | Mengikuti skor validasi per (komoditas, horizon), § 6 keputusan K2.                                                                                                                                                                                                                                                                                                         |

### Perubahan produk

- Label "Data demo" hilang otomatis saat bundel ARIF-Net aktif. Halaman Prediksi menampilkan versi model dan tanggal data, seperti yang sudah disiapkan.
- Halaman **ARIF-Net Kenalan** dan **Keterbatasan** memuat skor validasi nyata (tabel di atas) dan tiga keterangan wajib di § 1. Angkanya dibaca dari `model.json`, tidak ditulis tangan.
- Bundel demo tetap ada sebagai cadangan pengembangan. ADR 0006 diperbarui, dan ADR 0012 mencatat penerapan ARIF-Net (salinan inferensi, safetensors, kontainer sekali jalan).
- Data harga tidak berubah karena sudah identik. Sinyal konteks (berita/iklim/BBM dari ARIF-Net) **tidak** dimasukkan di fase ini, karena A0 tidak memakainya dan berita memuat teks media pihak ketiga. Tetap "Sinyal konteks menyusul".

Uji yang ditambahkan:

- **pytest:** kesetaraan fitur dan prediksi dengan pipeline ARIF-Net (contoh beku), safetensors ditolak bila sha tidak cocok, monoton, satu baris per (komoditas, horizon), dan tanpa pickle.
- **Integrasi:** promosi bundel ARIF-Net menggeser demo.
- **E2E:** halaman Prediksi tanpa label demo dengan versi model tampil, dan halaman ARIF-Net memuat skor.
- **Infra-check:** `model-export` tanpa port.

## 4. Bagian C — Peringatan, notifikasi, ringkasan mingguan (desain § 4 2B)

### Data (migrasi `0007_alerts.sql`)

- `alert_subscriptions`:
  - kolom: `user_id`, `market_id`, `commodity_id`, `rule` (`unusual_move` | `forecast_rise` | `price_threshold`), `threshold_idr` (hanya untuk aturan ambang), `direction` (`above` | `below`), `active`, `created_at`;
  - unik per (pengguna, pasar, komoditas, aturan);
  - batas 20 langganan per pengguna.
- `notifications`:
  - kolom: `user_id`, `kind` (`alert` | `weekly`), `subscription_id` (null untuk ringkasan), `title`, `body`, `data_date`, `model_version` (aturan prediksi), `read_at`, `created_at`;
  - kunci idempoten unik (`user_id`, `subscription_id`, `data_date`) untuk kabar peringatan, dan (`user_id`, minggu) untuk ringkasan;
  - retensi 180 hari, dinyatakan di `/privasi`.
- Hapus akun menghapus keduanya (`ON DELETE CASCADE`).

### Aturan

| Aturan                       | Pemicu                                                                                                                                   | Isi pesan (fakta, non-kausal)                                       |
| ---------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------- |
| Pergerakan di luar kebiasaan | \|perubahan 7 hari\| > persentil 90 perubahan 7 hari komoditas itu (730 hari terakhir)                                                   | "Harga cabai merah keriting naik 18% dalam 7 hari (biasanya ≤ 9%)." |
| Prediksi naik > 2%           | Bundel aktif **non-demo** dengan q50 h7 atau h30 > +2%. Hanya komoditas `covered`. Tidak pernah dari bundel demo.                        | Menyebut horizon, rentang q10–q90, versi model, dan tanggal data.   |
| Harga melewati batas saya    | Harga terakhir melewati ambang ke arah yang dipilih, dibanding harga sebelumnya. Dipicu saat melewati, bukan setiap hari di atas ambang. | Harga, ambang, tanggal data.                                        |

Hanya akun terverifikasi yang mendapat kabar. Akun yang belum terverifikasi bisa membuat langganan, dengan status "aktif setelah email diverifikasi".

### Alur

1. `POST /internal/cache/invalidate` (impor harga) dan promosi bundel menaruh satu pekerjaan `alerts:evaluate {scope, dataDate}` (jobId deterministik, jadi impor ganda tidak menggandakan pekerjaan).
2. Worker menghitung statistik per (pasar, komoditas) satu kali, lalu mengevaluasi semua langganan aktif dalam query berkelompok (tanpa N+1). Kabar ditulis dengan `INSERT … ON CONFLICT DO NOTHING` pada kunci idempoten.
3. **Ringkasan mingguan:** pekerjaan berulang BullMQ setiap Senin 06.00 WIB. Untuk setiap pengguna terverifikasi dengan langganan aktif, isinya fakta 7 hari per komoditas yang diikuti. Dikirim ke aplikasi dan email (bisa dimatikan di `/akun`; tautan berhenti berlangganan di email memakai token sekali pakai).
4. Pembatasan: paling banyak 1 kabar per langganan per tanggal data, dan email peringatan dirangkum per pengguna per evaluasi (bukan satu email per aturan).

### API (`/v1`, sesi + CSRF untuk perubahan)

- `GET/POST /v1/alerts`, `PATCH/DELETE /v1/alerts/:id`.
- `GET /v1/notifications?tab=all|unread|weekly&cursor=`, `POST /v1/notifications/read` (id atau semua), `GET /v1/notifications/unread-count`.
- Kontrak di `packages/contracts/src/alerts.ts`. Kepemilikan diperiksa di query (`WHERE user_id = $sesi`), dengan uji IDOR.

### Web

- `/peringatan`: daftar langganan dan formulir tambah, sesuai prototipe `d_peringatan`/`m_peringatan`, dengan status kosong "Belum ada peringatan". Server Actions, nonce CSP, `private, no-store`.
- `/notifikasi`: tab Semua / Belum dibaca / Ringkasan mingguan, dan "Tandai semua dibaca".
- **Lonceng** di navigasi: komponen klien kecil yang membaca Route Handler `GET /api/unread-count` (tidak di-cache). Hanya dimuat bila ada cookie sesi, jadi halaman publik tetap statis dan tanpa cookie (dijaga uji yang sudah ada).
- Tautan "Peringatan" yang dulu "segera hadir" kini aktif.

### Uji Bagian C

- **Unit:** aturan (batas persentil, arah melewati ambang, bundel demo ditolak).
- **Integrasi:**
  - evaluasi berkelompok (jumlah query tetap untuk 1 dan 500 langganan);
  - idempoten (dua impor menghasilkan satu kabar);
  - akun belum terverifikasi tidak mendapat kabar;
  - IDOR;
  - ringkasan mingguan (jam diatur).
- **E2E:**
  - buat peringatan, impor data, lalu kabar muncul dan lonceng bertambah;
  - tandai dibaca;
  - email ringkasan di Mailpit;
  - halaman publik tetap ter-cache.
- **Uji beban:** halaman publik tetap dalam anggaran saat evaluasi 5.000 langganan berjalan.

## 5. Dokumen yang diperbarui

- **ADR:** ADR 0012 (penerapan ARIF-Net) dan pembaruan ADR 0006.
- **Kontrak dan data:**
  - `docs/api/v1.md`;
  - `docs/data/kontrak-bundel-prediksi.md` (versi model ARIF-Net);
  - `docs/data/kamus-data.md`.
- **Keamanan dan privasi:** `docs/security/autentikasi.md` (HP terenkripsi, tombol mata), `cookie-dan-privasi.md`, `dependensi.md`.
- **Operasi:** `docs/operations/menjalankan-lokal.md` (cara mengekspor dan mempromosikan bundel ARIF-Net).
- **Penutup:** `CHANGELOG.md`, lalu audit `docs/audits/fase-2b.md` beserta tangkapan layar.

## 6. Keputusan yang dibutuhkan dari pemilik

- **K1 — Kalender hari raya 2027.** Prediksi h180/h365 membutuhkan tanggal Ramadan, Idulfitri, dan Iduladha 2027. Tanggal resminya ditetapkan SKB, dan saya tidak bisa memastikannya sendiri. Pilihannya:
  - (a) tim pemodelan menambahkan tanggal 2027 ke `configs/calendar_holidays.json` ARIF-Net, dan produk menyalinnya;
  - (b) produk memakai perkiraan kalender Hijriah dengan catatan "perkiraan", sampai SKB tersedia.
- **K2 — Status evaluasi per sel.**
  - Usul saya: `available` untuk sel dengan relMAE validasi < 1, `partial` untuk sel ≥ 1 (setara "harga tetap"), dan keterangan "uji prospektif belum dibuka" di semua sel.
- **K3 — Cara menjalankan inferensi.**
  - Usul saya: kontainer sekali jalan `model-export` (torch CPU dipin, sekitar 1 GB image, bisa diulang di mesin mana pun).
  - Alternatif: skrip yang dijalankan dari env conda `ARIF-Net` di laptop ini. Lebih ringan, tetapi bergantung pada mesin dan folder ARIF-Net.

### Keputusan pemilik (19 Nov 2026)

- **K1:** perkiraan kalender Hijriah 2027 dengan catatan "perkiraan" (ADR 0012, halaman Keterbatasan), diganti tanggal SKB bila tersedia.
- **K2:** `available` bila relMAE validasi < 1, `partial` bila ≥ 1, dan semua sel diberi keterangan uji prospektif belum dibuka.
- **K3:** kontainer sekali jalan `model-export`.
