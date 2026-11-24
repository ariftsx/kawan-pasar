# ADR 0016 — Apache Airflow sebagai orkestrator pipeline

- Status: **Diterima** (24 Nov 2026, Fase 4B)
- Terkait: desain Fase 4 (P1, P4, P5, P6, P8), rencana `docs/plans/2026-11-23-fase-4b-airflow.md` (K1–K4), ADR 0015 (pipeline latih ulang dan kunci uji prospektif)

## Konteks

Proposal capstone menetapkan bahwa pipeline otomatis berjalan di Apache Airflow. Pipeline Fase 4A (`kp-pipeline`) sudah bisa dijalankan dari baris perintah, tetapi belum terjadwal, belum mengimpor harga ke produk secara otomatis, dan kandidatnya belum sampai ke Core API untuk diaudit admin. Mesin pengembangan terbatas (host 7,7 GB), sementara pelatihan sendiri memakai sekitar 3 GB.

## Keputusan

1. **Airflow 3.3.2 ramping, profil `airflow` terpisah (K2, K3):**
   - tiga kontainer: `airflow-api-server` (UI dan REST API, hanya `127.0.0.1:8081`), `airflow-scheduler` (LocalExecutor: tugas berjalan di sini), dan `airflow-dag-processor`;
   - layanan sekali jalan `airflow-db` (role dan database, idempoten) dan `airflow-init` (`airflow db migrate` dan pool `kp_store`);
   - tanpa Celery, Redis, atau worker terpisah. Stack produk tetap berjalan tanpa profil ini.
2. **Database sendiri:** role `airflow` hanya memiliki database `airflow`. Role ini tidak bisa terhubung ke `kawanpasar`, dan role aplikasi tidak bisa terhubung ke `airflow`.
3. **DAG hanya mengorkestrasi:**
   - setiap langkah adalah panggilan CLI ke venv masing-masing: `kp-pipeline` (Python 3.12, PyTorch CPU) dan `kp_ingest` (Python 3.14, dipasang lewat uv);
   - Python milik Airflow tidak pernah mengimpor kode pipeline;
   - pengaturan Airflow (`AIRFLOW__*`: URL database, kunci Fernet, rahasia JWT) dihapus dari lingkungan setiap langkah;
   - kredensial produk diberikan per langkah: hanya `register` yang menerima token layanan, hanya `import-pihps` yang menerima URL database ingest, dan run pipeline (kode ARIF-Net yang mengakses internet) tidak menerima apa pun;
   - pool `kp_store` (1 slot) menjaga satu penulis pada gudang bukti lintas DAG;
   - tanpa soket Docker.
4. **Jadwal (K4):**
   - `harga_harian`: Senin–Jumat 10.00 WIB, menjalankan kunci → koleksi dan preprocessing → `import-pihps` (batas tanggal dari `run.json`) → pembersihan run harga lama;
   - `latih_ulang`: Senin 02.00 WIB, menjalankan kunci → kuota → run penuh → daftar kandidat.
   - Keduanya memakai `catchup=False` dan `max_active_runs=1`.
5. **Kunci prospektif dihormati di orkestrator:**
   - selama kunci tertutup, run terjadwal dilewati (_skipped_, bukan gagal) dengan alasannya;
   - `latih_ulang` dapat dijalankan manual dengan `even_if_locked` untuk verifikasi, dengan data ≤ 30 Sep 2026, yang diizinkan protokol;
   - kunci hanya terbuka bila `OPENED.json` dan `REGISTERED.json` asli (sha256 tercatat) diletakkan berdampingan. Keduanya dipasang baca-saja dan tidak pernah masuk image atau repo.
6. **Kandidat ke Core API:**
   - `POST /internal/model-candidates` dengan token layanan;
   - idempoten: run dan bundel yang persis sama dijawab 200 dengan id lama, sehingga percobaan ulang Airflow tidak gagal. Run id atau bundel id yang dipakai pendaftaran lain dijawab 409;
   - kontrak menolak kandidat dengan `lockOpen` false yang datanya melewati 30 Sep 2026;
   - run `train-*` (berisi bundel yang menunggu audit) tidak dibersihkan otomatis di 4B;
   - tabel `model_candidates` tidak bisa dihapus oleh role aplikasi;
   - admin melihat daftar di `GET /v1/admin/model-candidates`. Audit, persetujuan, dan penolakan (yang memicu latih ulang) ada di 4C.
   - Maksimal 3 latih ulang per hari (desain § 4).
7. **Akun:** SimpleAuthManager dengan dua pengguna dari `.env`: `admin` untuk UI, dan `kawanpasar-api` (peran `user`: melihat dan memicu DAG) untuk Core API di 4C. Semua rahasia dibuat oleh `gen-env --add-missing`.

## Konsekuensi

- **Kebutuhan memori:** Docker Desktop perlu 6 GB (K1). Pada backend WSL2, batas ini diatur lewat `.wslconfig`, bukan menu Resources. Saat diam, ketiga kontainer Airflow memakai sekitar 590 MiB; run uji `quick` mencapai puncak sekitar 1 GB di scheduler. Dengan host 7,7 GB, Windows hanya punya sisa sekitar 1,7 GB selama latih ulang penuh.
- **Image:** image Airflow memuat dua venv, PyTorch, dan kode ARIF-Net yang terverifikasi manifest. Membangunnya lama, dan image-nya besar.
- **Sebelum pembukaan:** sampai pembukaan prospektif (paling cepat 3 Des 2026), kedua DAG terjadwal akan dilewati setiap kali dengan alasan kunci. Ini perilaku yang diharapkan.
- **Lisensi:** Airflow berlisensi Apache 2.0, dan tidak ada kode Airflow yang disalin ke repo.
