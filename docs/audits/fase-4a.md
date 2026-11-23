# Audit Fase 4A — Pipeline Latih Ulang ARIF-Net

- Tanggal: 23 November 2026
- Rencana: [`docs/plans/2026-11-23-fase-4a-pipeline-arifnet.md`](../plans/2026-11-23-fase-4a-pipeline-arifnet.md) · Desain: [`docs/design/2026-11-23-fase-4-pipeline-design.md`](../design/2026-11-23-fase-4-pipeline-design.md) (P1–P8)
- ADR baru: [0015 — Pipeline latih ulang ARIF-Net dan kunci uji prospektif](../architecture/adr/0015-pipeline-latih-ulang-arifnet.md)
- Status: **23/23 gerbang lulus**; gerbang yang terdampak perbaikan tinjauan dijalankan ulang pada kode akhir (§ 2)

## 1. Yang dihasilkan

| Bagian             | Hasil                                                                                                                                                                                                                        |
| ------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Salinan ARIF-Net   | 30 berkas (A0 saja) dari folder lokal, commit dasar `7ae2731` + perubahan lokal, `MANIFEST.sha256` dicek sebelum setiap run, MIT                                                                                             |
| Kunci protokol     | Ringkasan registrasi di repo; `OPENED.json` (di-gitignore) harus pembukaan prospektif selesai, bukan uji coba, konfigurasi beku sama. Status sekarang: **terkunci, batas data 2026-09-30**                                   |
| Pipeline           | `prepare → collect → preprocess → prices → train → bundle`, `run.json` dapat dilanjutkan, CLI `kp-pipeline status\|seed\|run`, `pnpm pipeline status\|run\|import`, kontainer `pipeline` (Python 3.12, PyTorch CPU, 1,81 GB) |
| Penilaian kandidat | Metode fold ARIF-Net (purging), relMAE per komoditas × horizon, rata-rata 5 seed → `eval_status` produk                                                                                                                      |
| PIHPS di produk    | `kp_ingest import-pihps` dengan batas tanggal wajib; cabai rawit `com_15`/`com_16` dari referensi resmi PIHPS                                                                                                                |

## 2. Gerbang mutu (`COMPOSE_PARALLEL_LIMIT=1 pnpm audit:all`)

| Gerbang                                                                   | Hasil                                                                                                                  |
| ------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------- |
| 20 gerbang lama + baru `pipeline-tests`, `pipeline-mypy`, `pipeline-ruff` | ✔ 23/23                                                                                                                |
| Sesudah perbaikan tinjauan (§ 4)                                          | `pipeline-tests` (44 uji, cakupan 91%), `pipeline-mypy`, `pipeline-ruff`, `format` dijalankan ulang pada kode akhir: ✔ |

| Paket    | Uji                                                                                                                                                                                                                                                                             |
| -------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| pipeline | 44, termasuk run ujung ke ujung **hermetis** (gudang PIHPS sintetis berformat PIHPS, tanpa jaringan, semua langkah nyata termasuk `kp_model`, ±4,5 menit). `train.py` dikecualikan dari pengukuran cakupan karena berjalan sebagai subproses; uji hermetis menjalankannya penuh |
| ingest   | 60 (baru: sumber PIHPS, batas tanggal, CLI `import-pihps`)                                                                                                                                                                                                                      |
| catalog  | 8 (baru: ID cabai rawit, cermin pipeline sama dengan katalog)                                                                                                                                                                                                                   |
| e2e      | aturan diganti: cabai rawit kini berharga, prediksi tetap "menyusul"                                                                                                                                                                                                            |

## 3. Run nyata (data ≤ 2026-09-30)

| Run                   | Hasil                                                                                                                                    |
| --------------------- | ---------------------------------------------------------------------------------------------------------------------------------------- |
| Impor awal gudang     | 279 potongan (3 komoditas × 93 bulan) dari folder ARIF-Net lokal, sha256 dicek, tidak ada potongan sesudah Sep 2026                      |
| `4a-cutoff` (Windows) | collect 6 menit (186 potongan cabai rawit dari PIHPS), preprocess 3 menit, train 19 menit, bundle 3 detik. Data 5 komoditas × 1.953 hari |
| Kontainer `--quick`   | sukses; `sudah=465 sisa=0` (tanpa jaringan)                                                                                              |
| Impor ke produk       | 3.906 baris cabai rawit masuk, 5.859 dilewati (sudah ada), 0 ditolak                                                                     |

**Kandidat `4a-cutoff`:** relMAE gabungan **0,867** (jendela evaluasi 30 Sep 2024 – 30 Sep 2025; riset A0 0,850 pada fold lain). Bundel 40 baris (5 × 8), kuantil berurutan, `eval_status` 27 `available` / 13 `partial`. Verifikator bundel Core API: satu-satunya alasan tolak `coverage` (cabai rawit belum tercakup model di katalog), sesuai rancangan.

| relMAE               | h=1  | 7    | 30       | 90       | 180      | 365      |
| -------------------- | ---- | ---- | -------- | -------- | -------- | -------- |
| Cabai merah keriting | 1,00 | 0,99 | 0,91     | 0,70     | 0,85     | 0,63     |
| Bawang merah         | 1,00 | 0,98 | 0,97     | 0,99     | 0,92     | 0,82     |
| **Beras medium I**   | 1,00 | 1,00 | **1,88** | **2,52** | **2,26** | **2,17** |
| Cabai rawit hijau    | 1,00 | 0,98 | 0,90     | 0,73     | 0,65     | 0,79     |
| Cabai rawit merah    | 1,00 | 1,00 | 0,88     | 0,76     | 0,81     | 0,97     |

**Temuan untuk audit kandidat:** beras jauh lebih buruk dari naive untuk horizon ≥ 14 hari pada jendela ini, padahal di fold riset sekitar 1,0. Dugaan: harga beras sangat stabil di jendela ini (penyebut relMAE kecil), dan/atau efek model bersama 5 komoditas. Belum dibuktikan. Karena K2, prediksi beras pada horizon itu otomatis berstatus "sebagian". Skor ini **bukan bukti independen** (jendela dapat beririsan dengan data seleksi A0; fit yang dinilai ≠ fit yang dirilis), dan dicatat di spesifikasi kandidat.

## 4. Tinjauan independen (baca-saja)

- **High:** tidak ada. Tidak ada jalur langsung bagi data sesudah 2026-09-30 selama terkunci.
- **Medium (2, diperbaiki dengan uji yang gagal dulu):**
  1. Setelah kunci terbuka, potongan bulan yang diambil di tengah bulan dianggap selesai dan membeku sampai bulan berganti. Kini `forget_open_month` melupakan setiap potongan yang lebih pendek dari bulannya (dan dari batas data) agar diambil ulang; bukti mentah lama tetap disimpan.
  2. Run terkunci tidak menolak gudang yang berisi potongan sesudah batas (preprocessing ARIF-Net membaca semua potongan OK). Kini `prepare` menolak sebelum apa pun berjalan.
- **Low, diperbaiki:** `prepare` yang gagal kini bisa diulang (folder salinan dihapus dengan melepas tautan gudang lebih dulu); `--run-id` divalidasi; `SOURCE.md`/manifest hanya dikecualikan di root salinan; nama manifest dengan `..`/absolut ditolak; catatan "bukan bukti independen" di skor kandidat.
- **Low, diterima:** `OPENED.json` buatan tangan dapat membuka kunci karena hash konfigurasi beku publik (operator lokal, ditinjau saat 4B); pembulatan harga (PIHPS selalu bulat); impor awal dari folder lokal tanpa validasi tambahan.

## 5. Keputusan pelaksanaan

| #    | Keputusan                                                                                                                                                                                                              |
| ---- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 4A-1 | Python 3.12 dan pustaka persis `requirements-lock.txt` ARIF-Net; pandas 3.1.1 dikecualikan dari gerbang `exclude-newer` (terbit beberapa jam sesudah batas, umur 19 hari); PyTorch CPU dari indeks PyTorch untuk Linux |
| 4A-2 | Pipeline memaksa `ARIFNET_PHASE=development` (fase prospective memakai cutoff 30 Nov sebagai batas data)                                                                                                               |
| 4A-3 | Gudang bukti mentah permanen di luar folder run; riwayat 3 komoditas diimpor sekali dari folder ARIF-Net lokal                                                                                                         |
| 4A-4 | Berkas iklim pengganti satu kolom konstan: `SequenceBank` selalu membacanya, A0 tidak memakai iklim (`modalities: []`); nol kolom membuat `build_fold` gagal                                                           |
| 4A-5 | Penilaian kandidat dengan metode fold ARIF-Net, mengisi `validation.by_commodity` untuk `eval_status` (K2)                                                                                                             |
| 4A-6 | Satu interpreter di image; `kp_model` dijalankan dari sumbernya (119 ujinya lulus di 3.12); jalur lewat `paths.py` (`KP_PIPELINE_HOME`, `KP_PRODUCT_CALENDAR`)                                                         |
| 4A-7 | Kalender produk (riset + perkiraan 2027, K1) dipakai untuk bundel kandidat, karena prediksi melihat sampai 365 hari ke depan                                                                                           |
| 4A-8 | Mode `smoke` collector tidak dipakai untuk mencari ID cabai rawit (mengambil potongan uji yang bisa sesudah cutoff); hanya daftar referensi                                                                            |

## 6. Kesalahan selama pelaksanaan (dan perbaikannya)

- Run #1: tautan gudang dibuat dari jalur relatif dengan `..` → junction Windows rusak. Collector berhenti sebelum menulis apa pun (hanya _warm-up_ yang menghubungi PIHPS). Perbaikan: jalur di-resolve absolut; uji regresi.
- Run #2: `--root` relatif tidak ditemukan oleh subproses (cwd = salinan run). Perbaikan: semua jalur run di-resolve sekali di awal; uji regresi.
- Run #3: berkas iklim tanpa kolom (`reshape(-1, 0)`). Perbaikan: satu kolom konstan (4A-4).
- Pemeriksaan sebelum commit: 29 dari 32 berkas salinan ARIF-Net ber-CRLF (seperti sumbernya), dan aturan repo `* text=auto eol=lf` akan menormalkannya saat commit, sehingga setiap _clone_ baru gagal verifikasi manifest. Perbaikan: `.gitattributes` `services/pipeline/vendor/** -text` (pola yang sama dengan fixture CSV ingest); dibuktikan dengan `git hash-object` (blob yang disimpan = blob mentah).
- Penghapusan folder run berisi tautan gudang berisiko menghapus gudang; setiap penghapusan dilakukan dengan melepas tautan lebih dulu, dan gudang dicek utuh (465 potongan) setiap kali. Kini menjadi `remove_run_dir`.

## 7. Catatan untuk pemilik

- **Sebelum 4B:** naikkan memori Docker Desktop ke ±6 GB (sekarang 3,7 GB). Pelatihan di kontainer bersama 11 kontainer lain berisiko kehabisan memori.
- **Kunci terbuka** setelah Anda meletakkan `results/prospektif/OPENED.json` dari ARIF-Net (sesudah pembukaan resmi, paling cepat 3 Des 2026) ke `services/pipeline/config/prospective/OPENED.json`.
- **Cabai rawit** kini tampil harganya (riwayat sampai 30 Sep 2026); prediksinya menunggu bundel 5 komoditas disetujui admin (4C).
- **Terbuka untuk 4B/4C:** cakupan model produk harus mengikuti bundel yang disetujui, bukan konstanta katalog; perintah pembersihan run lama; skor beras perlu dicermati saat audit kandidat pertama.
