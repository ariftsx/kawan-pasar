# Desain Fase 4 — Pipeline Otomatis ARIF-Net (PIHPS → Prediksi)

- Tanggal: 23 November 2026
- Status: **disetujui pemilik 23 Nov 2026**
- Dasar: rencana fase desain utama § 14 (Fase 4: adapter PIHPS, integrasi model), proposal (pipeline otomatis dengan Apache Airflow), dan protokol uji prospektif ARIF-Net v1.1.0 (`DECIDED`)

## 1. Keputusan pemilik (23 Nov 2026)

| #   | Keputusan                                                                                                                                                                                                                             |
| --- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| P1  | PIHPS diambil **otomatis harian** dengan sopan (jeda acak, User-Agent generik, bukti mentah + sha256).                                                                                                                                |
| P2  | Cabai rawit hijau dan cabai rawit merah **ikut diambil**, dan pipeline otomatis melatih ARIF-Net untuk **5 komoditas**.                                                                                                               |
| P3  | Backfill harga **sejak 1 Okt 2026**.                                                                                                                                                                                                  |
| P4  | Pipeline penuh: koleksi → preprocessing → latih ulang **ARIF-Net A0 saja** (tanpa 13 model pembanding) → bundel, dijalankan **Apache Airflow**, dipantau dan dijadwalkan dari halaman admin.                                          |
| P5  | **Patuhi protokol uji prospektif:** pengambilan data sesudah 30 Sep 2026 dan latih ulang terkunci sampai pembukaan resmi (bukti `OPENED.json` dari ARIF-Net).                                                                         |
| P6  | **Airflow ramping** di profil Compose terpisah (`pipeline`); memori Docker Desktop dinaikkan pemilik (±6 GB).                                                                                                                         |
| P7  | Kode ARIF-Net **disalin dari folder lokal** `D:\.Capstone dan TA\ARIF-Net` (versi terbaru, termasuk perubahan yang belum di-commit), hanya modul yang dibutuhkan A0, dengan lisensi MIT dan sidik sha256. Repo ARIF-Net tidak diubah. |
| P8  | **Admin wajib mengaudit dan menyetujui** setiap bundel hasil latih ulang. Menolak → pipeline latih ulang dijalankan lagi.                                                                                                             |

## 2. Batasan dari protokol uji prospektif

Protokol v1.1.0 § 4: "pipeline mingguan (Airflow/PC) **tidak** menjalankan training atau evaluasi pada data sesudah 2026-09-30 sebelum langkah 7", dan angka prospektif tidak boleh dilihat sebelum pembukaan (paling cepat C + 3 hari = 3 Des 2026). Karena itu:

- **Kunci protokol** (`protocol lock`) di setiap tugas pipeline yang menyentuh data sesudah 30 Sep 2026: koleksi harga sesudah cutoff, impor ke produk, dan latih ulang. Kunci terbuka hanya bila berkas `OPENED.json` dari ARIF-Net diletakkan pemilik di `config/pipeline/prospective/` dan sha256 `REGISTERED.json` di dalamnya cocok dengan salinan yang disimpan Kawan Pasar.
- Sebelum dibuka, pipeline tetap bisa **dibangun dan diuji ujung ke ujung** dengan data ≤ 30 Sep 2026 (termasuk riwayat cabai rawit ≤ cutoff), tanpa menampilkan apa pun di produk (bundel uji berstatus `candidate`, tidak pernah aktif otomatis).
- Halaman admin menampilkan status kunci ("Menunggu pembukaan uji prospektif") dan alasannya.

## 3. Arsitektur

```
Airflow (profil pipeline, LocalExecutor, metadata di DB `airflow` pada Postgres yang sama)
 ├─ DAG harga_harian   (hari kerja 10.00 WIB) : kunci? → koleksi PIHPS (5 komoditas, Kramat Jati) → validasi
 │                                              → impor ke price_observations (layanan ingest) → invalidasi cache
 └─ DAG latih_ulang    (jadwal diatur admin)  : kunci? → koleksi kalender → preprocessing (harga + kalender)
                                                 → fit A0 (5 seed) → konversi bobot (.npz) → bundel prediksi
                                                 → uji kandidat (gerbang mutu, laporan) → bundel `candidate`
Core API (admin)  ── REST API Airflow (jaringan internal, akun layanan) ──  status run, picu, jeda, jadwal
Admin web         : Pipeline (run, log ringkas, jadwal), Model (audit kandidat: metrik, contoh prediksi,
                    cek runtime) → Setujui (promosi) / Tolak (catatan → picu latih ulang)
```

- **Kontainer `pipeline`:** satu image Python (Airflow 3 + PyTorch CPU + kode ARIF-Net tersalin + `kp_ingest` + `kp_model`). Tanpa akses Docker socket. Data kerja di volume `pipeline-data` (bukti mentah, dataset, bobot, bundel).
- **Airflow UI** hanya di `127.0.0.1`; admin Kawan Pasar memakai REST API Airflow lewat Core API, tidak pernah langsung dari peramban.
- **Promosi bundel tetap lewat jalur Fase 1/2B** (`promoteBundle` dengan verifikasi skema dan sha256). Bundel baru masuk sebagai `candidate`; hanya persetujuan admin (dengan konfirmasi sandi, `audit_log`) yang membuatnya `active`.

## 4. Gerbang audit kandidat (P8)

Sebelum admin bisa menyetujui, kandidat harus lolos pemeriksaan otomatis, dan semuanya ditampilkan:

1. **Runtime:** bundel lolos verifikator yang sama dengan promosi; `kp_model` memuat bobot dan menghasilkan prediksi untuk 5 komoditas × 8 horizon tanpa galat; kuantil monoton.
2. **Mutu:** relMAE pada jendela uji terbaru (data yang sudah boleh dipakai menurut protokol) per komoditas dan horizon, dibandingkan dengan naive dan dengan bundel aktif. Kandidat dengan relMAE gabungan ≥ 1 ditandai **tidak lolos** (tombol setujui nonaktif).
3. **Kewajaran:** contoh prediksi per komoditas (median dan rentang) ditampilkan untuk diperiksa manusia.

Menolak menyimpan catatan admin dan memicu DAG `latih_ulang` lagi (dibatasi agar tidak berulang tanpa henti: maks 3 kali per hari).

## 5. Lima komoditas (P2)

- `comcat_id` cabai rawit hijau dan merah dicari dari daftar referensi PIHPS dan diverifikasi dengan mode `smoke` collector (sama seperti tiga komoditas lain), lalu dicatat di `packages/catalog` dan `docs/data/katalog.md`.
- Riwayat cabai rawit ≤ 30 Sep 2026 dikoleksi untuk latihan. Model 5 komoditas adalah **model baru** (embedding komoditas berbeda dari A0 yang diregistrasi); ini tidak menyentuh registrasi riset ARIF-Net, tetapi tetap baru dilatih untuk produksi sesudah kunci terbuka.
- Sampai bundel 5 komoditas disetujui, cabai rawit tampil harga dan riwayatnya (sesudah kunci terbuka), prediksinya "menyusul".

## 6. Sub-fase

| Sub-fase | Isi                                                                                                                                                                                                  | Gerbang             |
| -------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------- |
| **4A**   | `services/pipeline`: salinan kode ARIF-Net (A0, PIHPS, kalender, preprocessing, fit) + adapter PIHPS sebagai `PriceSource` di `kp_ingest`, kunci protokol, uji dengan fixture dan data ≤ cutoff, CLI | Audit 4A            |
| **4B**   | Airflow (profil `pipeline`, DB metadata, akun layanan), DAG `harga_harian` dan `latih_ulang`, bundel `candidate`, gerbang audit kandidat                                                             | Audit 4B            |
| **4C**   | Admin: halaman Pipeline (run, picu, jeda, jadwal, status kunci) dan Model (audit kandidat, setujui/tolak → latih ulang), dokumen, ADR                                                                | Audit 4C + simulasi |

## 7. Risiko

- **Memori:** Airflow + PyTorch ±2–3 GB saat latihan. Profil `pipeline` tidak jalan bersama uji beban; build image berurutan.
- **Ketergantungan situs PIHPS:** perubahan format respons → koleksi gagal tercatat (tidak ada data rusak yang masuk), terlihat di admin.
- **Kode tersalin bisa tertinggal dari ARIF-Net:** sidik sha256 per berkas dan sumber (commit + daftar perubahan lokal) dicatat; pembaruan salinan adalah keputusan eksplisit.

## 8. Di luar lingkup

Latih ulang 13 model pembanding, fitur berita/IndoBERT, iklim, BBM (A0 hanya harga + kalender), pasar selain Kramat Jati.
