# Audit Fase 4B — Apache Airflow

- Tanggal: 24 November 2026
- Rencana: [`docs/plans/2026-11-23-fase-4b-airflow.md`](../plans/2026-11-23-fase-4b-airflow.md) (K1–K4) · Desain: [`docs/design/2026-11-23-fase-4-pipeline-design.md`](../design/2026-11-23-fase-4-pipeline-design.md) (P1, P4, P5, P6, P8)
- ADR baru: [0016 — Apache Airflow sebagai orkestrator pipeline](../architecture/adr/0016-apache-airflow-orkestrasi-pipeline.md)
- Status: **23/23 gerbang lulus**. Tiga gerbang lulus pada ulangan dengan kode yang sama: `e2e-smoke`, `lighthouse`, dan `unit-tests` pada audit sebelumnya (§ 2).

## 1. Yang dihasilkan

| Bagian           | Hasil                                                                                                                                                                                                                                                                                                 |
| ---------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Airflow          | 3.3.2, profil `airflow`: `airflow-api-server` (UI dan REST di `127.0.0.1:8081`), `airflow-scheduler` (LocalExecutor), `airflow-dag-processor`, layanan sekali jalan `airflow-db` dan `airflow-init` (migrasi + pool `kp_store`). `pnpm airflow:up\|down`                                              |
| Image            | `kawan-pasar/airflow:local` 6,6 GB: venv pipeline (Python 3.12, PyTorch 2.15 CPU) dan venv ingest (Python 3.14). Kode milik root dan baca-saja (pengguna `airflow` ada di gid 0, sehingga hak tulis grup juga dicabut). Berkas kunci, `.venv`, dan cache dikecualikan lewat `Dockerfile.dockerignore` |
| DAG              | `harga_harian` (Sen–Jum 10.00 WIB) dan `latih_ulang` (Senin 02.00 WIB), `catchup=False`, `max_active_runs=1`. Selama kunci tertutup, run terjadwal dilewati dengan alasannya                                                                                                                          |
| Kandidat model   | Migrasi `0013_model_candidates` (aplikasi: SELECT/INSERT/UPDATE, tanpa DELETE), `POST /internal/model-candidates` (token layanan; sama → 200, bertabrakan → 409), `GET /v1/admin/model-candidates` (admin)                                                                                            |
| Kunci prospektif | Kini juga mewajibkan `REGISTERED.json` asli di samping `OPENED.json` (sha256 = `registered_file_sha256`). Kontrak menolak kandidat terkunci dengan `dataEnd` > 2026-09-30                                                                                                                             |
| Database Airflow | Role dan database `airflow` sendiri (`init/02-airflow.sh`, idempoten, juga untuk volume lama). Role `airflow` tidak bisa masuk ke `kawanpasar`, dan role aplikasi tidak bisa masuk ke `airflow`                                                                                                       |
| Rahasia          | `gen-env --add-missing`: `AIRFLOW_DB_PASSWORD`, `AIRFLOW_ADMIN_PASSWORD`, `AIRFLOW_API_PASSWORD`, `AIRFLOW_JWT_SECRET`, `AIRFLOW_FERNET_KEY` (44 karakter, base64 url-safe). Nilainya tidak pernah dicetak                                                                                            |
| CLI pipeline     | `register`, `runs-today`, `clean --prefix`                                                                                                                                                                                                                                                            |

## 2. Gerbang mutu (`COMPOSE_PARALLEL_LIMIT=1 pnpm audit:all`)

| Gerbang                                                                                                                                                                                                                                     | Hasil                                                                                                                                                    |
| ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------- |
| format, lint, typecheck, unit-tests, web-build, stack-rebuild, infra, integration-tests, test-db-reset, ingest (pytest, mypy, ruff), model (pytest, mypy, ruff), pipeline (pytest, mypy, ruff), dependency-audit, no-any, no-ai-attribution | ✔ 21/21 pada audit akhir                                                                                                                                 |
| e2e-smoke                                                                                                                                                                                                                                   | ✘ di audit, karena navigasi melewati batas waktu 5 detik. ✔ 317 uji pada ulangan setelah Airflow dimatikan                                               |
| lighthouse                                                                                                                                                                                                                                  | ✘ di audit (TBT 663–1707 ms), ✘ pada ulangan kedua (3 halaman), ✔ 8/8 pada ulangan ketiga dengan WSL 5 GB dan stack hangat (TBT 90–188 ms, LCP ≤ 1,14 s) |

**Penyebab kegagalan browser:** kode web tidak berubah di 4B, dan ukuran JS sama dengan audit 3A (141–146 KB).

- Saat audit berjalan, Docker memakai 6 GB dan Airflow ikut menyala, sehingga Windows hanya punya sekitar 0,5 GB RAM bebas untuk Chrome. TBT naik di semua halaman, termasuk halaman yang tidak disentuh 4B.
- Dengan `.wslconfig` `memory=5GB` dan `autoMemoryReclaim=gradual` (persetujuan pemilik), anggaran kembali terpenuhi.
- Kondisi ini khusus laptop pengembang. VPS produksi tidak menjalankan browser.

**Kegagalan sebelumnya:** pada audit yang dihentikan (kode berubah di tengah jalan), `unit-tests` gagal sekali di uji berbasis waktu `hash-gate` (29,8 ms, batas 20 ms) ketika mesin sedang sibuk. Uji itu lulus 3/3 saat dijalankan sendiri, dan lulus di audit akhir.

| Paket     | Uji                                                                                                                                                                                                 |
| --------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| pipeline  | 63 (cakupan 93,6%), termasuk run ujung ke ujung hermetis. Uji baru: kandidat (payload, idempoten, 409, NaN), `clean` (awalan, `run.json` rusak), helper DAG (kredensial per langkah, run id, galat) |
| api       | 103 unit, 242 integrasi. Uji baru: kandidat (201/200/409, token layanan, validasi, larangan `lockOpen` palsu, admin saja, aplikasi tidak bisa DELETE)                                               |
| contracts | 59                                                                                                                                                                                                  |
| infra     | `infra:check` kini memeriksa Airflow bila profilnya menyala: sehat, isolasi database dua arah, dan login UI (sandi salah ditolak, admin dan akun API diterima)                                      |
| DAG       | `check_dags.py` di dalam image: lolos import, jadwal, zona waktu, urutan tugas, pool, dan 7 pemeriksaan perilaku gerbang. Uji mutasi (pengecekan kunci dihapus) membuat pemeriksa gagal             |

## 3. Run nyata di Airflow (data ≤ 2026-09-30)

| Run                                              | Hasil                                                                                                                                                                                                            |
| ------------------------------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `harga_harian` manual                            | Keempat tugas dilewati, run tetap _success_, tanpa folder run baru. Alasan di log: "Uji prospektif ARIF-Net belum dibuka (OPENED.json belum ada)."                                                               |
| `latih_ulang` manual (`even_if_locked`, `quick`) | Semua tugas lulus. `retrain` 457 detik di pool `kp_store`, puncak memori scheduler sekitar 1 GB. Kandidat `pending`: 5 komoditas, data 2026-09-30, `lock_open` false, relMAE 0,967 (1 epoch; run penuh 4A 0,867) |
| Pengulangan                                      | Dua run dengan seed sama menghasilkan relMAE yang persis sama. Pendaftaran ulang run lama → `already_registered`, id sama, dan tidak ada baris baru                                                              |
| Memori                                           | Airflow diam: ~590 MiB (3 kontainer)                                                                                                                                                                             |

**Kegagalan yang ditemukan dan diperbaiki selama run nyata:**

- Path Python di image dasar Airflow adalah `/usr/python/bin`.
- `DagBag` 3.3 tidak lagi menerima `include_examples`.
- Folder DAG harus ada di `PYTHONPATH`.
- Run manual Airflow 3 tidak punya `ts_nodash`, sehingga run id kini dibuat dari `dag_run.run_after`.
- Pendaftaran kandidat sempat mendapat 404 karena image API yang berjalan masih lama; image dibangun ulang.

## 4. Tinjauan independen (baca-saja)

- **High:** tidak ada. Tidak ada jalur yang mengoleksi atau mengimpor data sesudah 2026-09-30 selama kunci tertutup.
- **Medium (4, semua diperbaiki dan diuji):**
  1. `clean --keep-latest 10` bisa menghapus folder run kandidat yang masih `pending` dalam waktu sekitar 2 minggu.
     - Perbaikan: `clean` hanya menghapus run `prices-*`.
     - Run `train-*` tidak dihapus di 4B; pembersihan menurut status kandidat dikerjakan di 4C.
  2. `SERVICE_TOKEN` dan `INGEST_DATABASE_URL` sampai ke kode ARIF-Net (yang mengakses internet) dan ke `kp_model`.
     - Perbaikan: kredensial diberikan per langkah, dan `run.py` juga membuang kredensial itu.
  3. Kedua DAG bisa menulis gudang bukti bersamaan (`max_active_runs` hanya berlaku per DAG).
     - Perbaikan: pool `kp_store` dengan 1 slot pada `collect_prices`, `clean`, dan `retrain`.
  4. Perilaku lewat-saat-terkunci belum diuji.
     - Perbaikan: 7 pemeriksaan perilaku di `check_dags.py`, ditambah uji mutasi.
- **Low, diperbaiki:**
  - batas tanggal impor dibaca dari `run.json`, bukan dari XCom;
  - tabrakan `bundleId` dari run lain kini 409 (galat), bukan "sudah terdaftar";
  - kontrak menolak `lockOpen` false dengan data sesudah batas;
  - skor NaN ditolak sebelum dikirim;
  - `run.json` rusak dilewati oleh `clean` dan `runs-today`;
  - `--keep-latest` minimal 1;
  - grup proses langkah dihentikan bila tugas dihentikan;
  - pengaman `:?` pada `INGEST_W_PASSWORD`.
- **Low, diterima:**
  - `airflow-api-server` ada di jaringan `edge`, karena port tidak bisa dipublikasikan dari jaringan `backend` yang internal;
  - rahasia compose terlihat di `docker inspect` (profil lokal);
  - batas koneksi role `airflow` 20 untuk 4 layanan dengan pool 3.

## 5. Catatan operasi

- **Dua kejadian di laptop, sudah pulih:**
  - Disk C: penuh oleh `docker_data.vhdx` (46 GB) sampai Docker berhenti. Disk dipindahkan ke `D:\DockerData\disk` dengan junction di lokasi lama, lalu build cache dibuang (20,9 GB, persetujuan pemilik).
  - `api` dan `worker` sempat dibuat ulang tanpa berkas dev-tools, sehingga port 3001 hilang, dan PostgreSQL ikut dibuat ulang saat port dipulihkan. Airflow kehilangan koneksi beberapa detik lalu pulih sendiri. `pnpm airflow:up` kini selalu memakai wrapper.
- **Terbuka untuk 4C:**
  - halaman admin Pipeline/Model: audit kandidat, setujui atau tolak (tolak → latih ulang, maksimal 3 per hari), pantau, dan jadwal lewat akun `kawanpasar-api`;
  - pembersihan run `train-*` menurut status kandidat;
  - cakupan model produk mengikuti bundel yang disetujui;
  - skor beras perlu dicermati.
- **Terbuka untuk Fase 5:** deployment ke VPS (2 vCPU, 8 GB). Batas CPU latih ulang, UI Airflow lewat SSH tunnel saja, serta uji beban ulang di VPS.
