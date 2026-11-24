# Audit Fase 4C — Admin Pipeline dan Model

- Tanggal: 25 November 2026
- Rencana: [`docs/plans/2026-11-24-fase-4c-admin-pipeline-model.md`](../plans/2026-11-24-fase-4c-admin-pipeline-model.md) (K1–K4) · Desain: [`docs/design/2026-11-23-fase-4-pipeline-design.md`](../design/2026-11-23-fase-4-pipeline-design.md) § 2–4
- ADR baru: [0017 — Admin Pipeline dan Model, cakupan prediksi mengikuti bundel aktif](../architecture/adr/0017-admin-pipeline-model-cakupan-dinamis.md)
- Status: **22/23 gerbang lulus**; `lighthouse` belum lulus karena beban CPU host (§ 2), bukan karena kode web

## 1. Yang dihasilkan

| Bagian               | Hasil                                                                                                                                                                                                                                                     |
| -------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Cakupan dinamis (K1) | Komoditas tercakup bila bundel aktif punya prediksi 7 harinya; sebelum ada bundel aktif, nilai katalog dipakai. Verifikator hanya menolak komoditas di luar katalog. Web memakai `modelCoverage` dari API. Komoditas di luar bundel aktif kini "menyusul" |
| Klien Airflow        | Core API sebagai satu-satunya jalan ke Airflow (akun `kawanpasar-api`, JWT di-cache, ulang sekali pada 401, batas waktu 5 detik, hanya 3 DAG Kawan Pasar). Airflow mati → "Airflow tidak aktif"                                                           |
| Jadwal (K2)          | 5 pilihan tetap di `pipeline_settings` (migrasi `0014`). `latih_ulang` berjalan tiap hari 02.00, dan `check_schedule` bertanya ke `/internal/pipeline/schedule`; run manual tidak bergantung pada jadwal                                                  |
| Status kunci         | DAG `status_kunci` tiap jam; hasilnya dibaca halaman Pipeline                                                                                                                                                                                             |
| Halaman Pipeline     | Kunci, jadwal, kuota 3/hari, 5 run terakhir per DAG dengan status tiap tugas, picu/jeda/lanjutkan; semua aksi perlu konfirmasi sandi dan tercatat di `audit_log`                                                                                          |
| Halaman Model        | Daftar kandidat; laporan audit (verifikator promosi + sha256 terdaftar + `data_cutoff`, mutu relMAE < 1 dibandingkan model aktif, tabel komoditas × horizon, contoh harga h7/h30/h90); Setujui (atomik) / Tolak (alasan wajib; latih ulang menurut K4)    |
| Protokol (K3)        | Kandidat dari run terkunci tidak bisa disetujui; dicek di Core API                                                                                                                                                                                        |
| Pembersihan          | `latih_ulang` membersihkan run `train-*`, menyimpan kandidat `pending`, bundel aktif, dan 3 run terbaru                                                                                                                                                   |

## 2. Gerbang mutu (`COMPOSE_PARALLEL_LIMIT=1 pnpm audit:all`)

| Gerbang                                                                                                                                                                                                                                     | Hasil                                                                                                                                                                                                                                                                                                                      |
| ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| format, lint, typecheck, unit-tests, web-build, stack-rebuild, infra, integration-tests, test-db-reset, ingest (pytest, mypy, ruff), model (pytest, mypy, ruff), pipeline (pytest, mypy, ruff), dependency-audit, no-any, no-ai-attribution | ✔ 21/21 pada audit akhir                                                                                                                                                                                                                                                                                                   |
| e2e-smoke                                                                                                                                                                                                                                   | ✘ 2 dari 320 di audit akhir: (1) uji 4C baru: sesudah penolakan tanpa alasan, kolom sandi kosong lagi sehingga klik kedua tidak terkirim. Uji diperbaiki dengan mengisi sandi lagi; perilaku formulir sama dengan admin 3B. (2) `/lainnya` teks 200% ("Test ended", acak). ✔ Ulangan `admin-pipeline` + `shell`: 260 lulus |
| lighthouse                                                                                                                                                                                                                                  | ✘ TBT 348–741 ms di semua halaman, termasuk halaman yang tidak disentuh 4C; LCP ≤ 1,18 s dan JS 141–146 KB sama dengan audit sebelumnya. Saat pengukuran, CPU host 37–82% karena TypeScript language server editor (bukan proses Kawan Pasar). **Harus diulang saat host tenang**                                          |

| Paket | Uji                                                                                                                                                                                                                                                                                                             |
| ----- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| api   | Baru: klien Airflow (6), jadwal (3), Pipeline/Model (10 integrasi: kunci, kuota, konfirmasi, audit log, kandidat terkunci, setujui → prediksi cabai rawit tampil, tolak → latih ulang, atomik, berkas diganti, data lewat batas, `superseded`, tanpa Airflow), cakupan (prediksi, ringkasan harga, verifikator) |
| web   | Pemilih komoditas prediksi mengikuti cakupan API                                                                                                                                                                                                                                                                |
| DAG   | `check_dags.py`: 3 DAG, jadwal, urutan, pool, 10 pemeriksaan perilaku (kunci, jadwal, kuota)                                                                                                                                                                                                                    |
| e2e   | Baru `admin-pipeline.spec.ts`: Pipeline tanpa Airflow + simpan jadwal (360/1280 px, axe), kandidat terkunci diaudit dan ditolak                                                                                                                                                                                 |

## 3. Simulasi dengan Airflow sungguhan (kunci tertutup)

Spesifikasi `tests/e2e/specs/simulation-4c.spec.ts` (`SIM_4C=1`, profil airflow menyala). Tangkapan layar di [`fase-4c/`](fase-4c/).

| Langkah                        | Hasil                                                                                                                                                                                                        |
| ------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Halaman Pipeline               | "Menunggu pembukaan uji prospektif", alasan "OPENED.json belum ada", run asli kedua DAG (run terjadwal hari Selasa dilewati di `check_schedule`, karena jadwalnya setiap Senin)                              |
| Latih ulang dari halaman admin | Dipicu dengan konfirmasi sandi; kuota "1 dari 3"                                                                                                                                                             |
| Run penuh di Airflow           | Keenam tugas lulus: `check_schedule` (run manual), `check_lock` (verifikasi), `check_quota`, `retrain` 1.401 detik, `register`, `clean`. Puncak memori scheduler yang tercatat ±1 GiB (sampel tiap 20 detik) |
| Kandidat baru                  | relMAE 0,867, sama persis dengan run penuh 4A (seed tetap)                                                                                                                                                   |
| Audit kandidat asli            | Bundel lolos verifikator promosi; relMAE per horizon dan contoh harga masuk akal; tidak bisa disetujui (terkunci)                                                                                            |
| Tolak                          | Alasan tersimpan; latih ulang tidak dipicu karena terkunci                                                                                                                                                   |
| Klien vs Airflow sungguhan     | `order_by=-run_after`, jalur XCom, dan bentuk hasil `status_kunci` dicocokkan langsung dengan Airflow 3.3.2                                                                                                  |

**Temuan dari simulasi, diperbaiki:** tombol "Setujui" yang nonaktif tampak sama dengan tombol aktif (komponen tombol tidak punya gaya untuk keadaan nonaktif). Tombol kini disembunyikan bila kandidat belum lolos audit, dan alasannya ditampilkan.

Alur Setujui dengan kunci terbuka diuji di uji integrasi (bundel sintetis, Airflow tiruan), bukan dengan `OPENED.json` sintetis di `config/prospective`: berkas pembukaan tidak pernah dibuat di luar ARIF-Net.

## 4. Tinjauan independen (baca-saja)

- **High:** tidak ada. Tidak ada jalur yang menyetujui kandidat terkunci.
- **Medium (3, diperbaiki dan diuji):**
  1. Setujui tidak atomik (promosi lalu keputusan terpisah): persetujuan dan penolakan bersamaan bisa menghasilkan bundel aktif dengan kandidat "ditolak". Kini klaim kandidat dan baris audit berjalan di dalam transaksi aktivasi (`PromoteOptions.inTransaction`).
  2. Bundel lebih lama dari bundel aktif tidak diperingatkan, dan promosi yang ditolak meninggalkan baris `rejected` permanen. Kini audit menandai `superseded`, dan promosi admin tidak mencatat baris `rejected`.
  3. Celah antara pengecekan sha256 saat audit dan promosi. Kini `promoteBundle` mencocokkan sha256 `SHA256SUMS` yang ia baca dengan yang terdaftar, dan menolak `data_cutoff` sesudah `dataEnd` kandidat; laporan audit memeriksa hal yang sama.
- **Low, diperbaiki:** folder bundel dicek dengan `realpath`.
- **Low, diterima (ADR 0017):** kuota dan pemicu tidak atomik (DAG tetap membatasi lewat `runs-today`); gerbang jadwal gagal tertutup bila API mati; komoditas bundel aktif yang kedaluwarsa tetap `covered`, tetapi prediksinya disembunyikan oleh aturan umur.

## 5. Catatan operasi

- Saat pemeriksaan ulang gerbang, saya tidak sengaja menjalankan proses audit kedua di latar. Proses itu membangun ulang stack di tengah e2e, sehingga 15 uji gagal karena batas waktu dan `fetch failed`. Proses dihentikan, lalu audit penuh dijalankan ulang sebagai satu-satunya proses (§ 2).
- E2E dijalankan dengan Airflow mati (halaman Pipeline diharapkan "Airflow tidak aktif"); simulasi § 3 dengan Airflow menyala.
- **Terbuka untuk Fase 5:** deployment ke VPS, uji beban ulang di VPS, dan pengaturan email produksi.
