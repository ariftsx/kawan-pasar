# ADR 0017 — Admin Pipeline dan Model, cakupan prediksi mengikuti bundel aktif

- Status: **Diterima** (25 Nov 2026, Fase 4C)
- Terkait: desain Fase 4 § 2–4 (P4, P5, P8), rencana `docs/plans/2026-11-24-fase-4c-admin-pipeline-model.md` (K1–K4), ADR 0015 (pipeline), ADR 0016 (Airflow), ADR 0014 (admin)

## Konteks

Sesudah 4B, Airflow menjalankan pipeline dan kandidat model tersimpan di `model_candidates`, tetapi admin belum bisa memantau, mengatur jadwal, atau memutuskan kandidat tanpa membuka UI Airflow. Cakupan prediksi masih berupa konstanta katalog, sehingga bundel 5 komoditas ditolak verifikator (`coverage`) dan cabai rawit tidak bisa mendapat prediksi tanpa mengubah kode.

## Keputusan

1. **Cakupan mengikuti bundel aktif (K1):**
   - komoditas berstatus `covered` bila bundel aktif punya prediksi 7 harinya;
   - sebelum ada bundel aktif, nilai katalog dipakai;
   - verifikator hanya menolak komoditas di luar katalog;
   - halaman web (hitungan cakupan, chip detail harga, pemilih prediksi) memakai `modelCoverage` dari API;
   - komoditas yang tidak ada di bundel aktif berstatus "menyusul" (`pending_coverage`), bukan lagi `unavailable`.
2. **Core API sebagai satu-satunya jalan ke Airflow:**
   - `AirflowClient` memakai akun `kawanpasar-api` (peran `user`) di jaringan `backend`;
   - JWT di-cache dan diminta ulang sekali bila mendapat 401; batas waktu 5 detik;
   - hanya DAG `harga_harian`, `latih_ulang`, dan `status_kunci` yang bisa dialamatkan;
   - bila Airflow mati atau tidak dikonfigurasi, halaman Pipeline menampilkan "Airflow tidak aktif".
3. **Jadwal sebagai pilihan tetap di database Kawan Pasar (K2):**
   - pilihan: setiap Senin, setiap hari, dua minggu sekali (Senin minggu ISO genap), Senin pertama tiap bulan, atau hanya manual; jam tetap 02.00 WIB;
   - `latih_ulang` berjalan setiap hari, dan tugas `check_schedule` bertanya ke `GET /internal/pipeline/schedule`;
   - run manual tidak bergantung pada jadwal;
   - tidak memakai Variable Airflow yang dibaca saat parsing (tidak disarankan dokumentasi Airflow) dan tidak menambah hak akun Airflow.
4. **Status kunci untuk admin:** DAG `status_kunci` (tiap jam, baca-saja) menjalankan `kp-pipeline status`, lalu Core API membaca hasil run terakhir yang berhasil.
5. **Audit dan keputusan kandidat (P8):**
   - laporan audit memuat:
     - verifikator promosi yang dijalankan tanpa menulis apa pun, ditambah pencocokan sha256 `SHA256SUMS` dengan yang terdaftar;
     - gerbang mutu relMAE gabungan < 1, dibandingkan dengan model aktif;
     - contoh prediksi rupiah pada h7/h30/h90;
   - **Setujui** memakai `promoteBundle` (jalur Fase 1/2B), lalu membuang cache dan me-revalidasi web sesudah commit:
     - klaim kandidat (`pending` → `approved`) dan baris audit berjalan di dalam transaksi aktivasi, sehingga keputusan bersamaan atau kegagalan tidak meninggalkan bundel aktif tanpa keputusan, atau sebaliknya;
     - berkas yang dibaca saat promosi harus sama dengan sha256 `SHA256SUMS` yang terdaftar, dan `data_cutoff` tidak boleh melewati `dataEnd` kandidat;
     - promosi admin yang ditolak tidak meninggalkan baris artefak `rejected`;
     - kandidat yang lebih lama dari bundel aktif ditandai `superseded`;
   - **Tolak** wajib disertai alasan;
   - keputusan diambil sekali, dari status `pending`;
   - kandidat dari run terkunci tidak bisa disetujui (K3), dan ini dicek di Core API;
   - penolakan memicu latih ulang hanya bila kunci terbuka dan kuota tersisa (K4).
6. **Kuota dan audit:**
   - maksimal 3 pemicu latih ulang per hari WIB, dihitung dari `audit_log` (`pipeline_trigger`) dengan jam aplikasi; DAG juga membatasi lewat `runs-today`;
   - semua aksi memerlukan konfirmasi sandi 10 menit dan tercatat di `audit_log` (`pipeline_*`, `model_*`).
7. **Berkas kandidat:**
   - folder run dipasang baca-saja ke API (`PIPELINE_RUNS_DIR`);
   - jalur bundel dibangun dari id yang sudah divalidasi regex dan dicek tetap di dalam folder itu;
   - `latih_ulang` membersihkan run `train-*` sambil menyimpan kandidat `pending` dan bundel aktif (`/internal/pipeline/keep-runs`) serta 3 run terbaru.

## Konsekuensi

- Setelah uji prospektif dibuka dan admin menyetujui kandidat 5 komoditas, prediksi cabai rawit tampil tanpa deploy.
- Sebelum pembukaan, halaman Model hanya berisi kandidat verifikasi yang bisa ditolak.
- Halaman Model tetap berfungsi tanpa Airflow, karena hanya butuh database dan berkas bundel.
- Mengubah jam latih ulang di luar 02.00 WIB memerlukan perubahan kode DAG.
- Bila bundel aktif sudah lebih dari 28 hari, komoditasnya tetap `covered`, tetapi prediksinya disembunyikan oleh aturan umur (konsisten dengan `forecastStatus`).
- Diterima (tinjauan independen, rendah):
  - pengecekan kuota dan pemicu tidak atomik; DAG tetap membatasi lewat `runs-today`;
  - bila API mati, gerbang jadwal gagal tertutup: run terjadwal hari itu terlewat, tetapi tidak ada yang dilatih tanpa izin.
