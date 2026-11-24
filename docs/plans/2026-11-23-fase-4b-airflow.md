# Rencana Fase 4B — Apache Airflow dan DAG Pipeline

- Tanggal: 23 November 2026
- Status: **disetujui pemilik 23 Nov 2026** (K1: Docker 6 GB; K2: Airflow 3.3.2; K3, K4 sesuai usulan)
- Desain: [`docs/design/2026-11-23-fase-4-pipeline-design.md`](../design/2026-11-23-fase-4-pipeline-design.md) § 3, § 6 · Prasyarat: Fase 4A (commit `3987438`)

## Kondisi mesin

Host 7,7 GB RAM (bebas ±0,8 GB saat stack jalan), Docker 3,7 GB / 4 CPU, 11 kontainer aktif. Pelatihan penuh memakai ±2–3 GB selama ±20 menit. Airflow (api-server + scheduler + dag-processor) butuh ±1–1,5 GB.

## Keputusan (pemilik, 23 Nov 2026)

| #   | Pertanyaan    | Usulan                                                                                                                                                                                                                                           |
| --- | ------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| K1  | Memori        | **Docker Desktop 6 GB** (pilihan pemilik; diusulkan 5 GB karena host 7,7 GB, sehingga Windows tersisa ±1,7 GB). Profil `pipeline` (Airflow) tidak dijalankan bersamaan dengan uji beban; saat pelatihan, batas memori kontainer pelatihan 2,5 GB |
| K2  | Versi Airflow | **3.3.2** (patch terakhir seri 3.3, rilis 17 Sep 2026); 3.4.0 baru 17 hari                                                                                                                                                                       |
| K3  | Topologi      | Tiga kontainer kecil dari satu image: `airflow-apiserver`, `airflow-scheduler` (LocalExecutor), `airflow-dag-processor`; metadata di database `airflow` (role sendiri) pada Postgres yang sama. Bukan `airflow standalone` (mode pengembangan)   |
| K4  | Jadwal bawaan | `harga_harian`: Senin–Jumat 10.00 WIB. `latih_ulang`: Senin 02.00 WIB. Keduanya diatur ulang dari admin di 4C                                                                                                                                    |

## Tugas

| #   | Tugas                                                                                                                                                                                                                                                                                     | Uji                                                                         |
| --- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------- |
| 1   | **Image Airflow** dari `apache/airflow:3.3.2-python3.12` + venv terpisah: `kp-pipeline` (3.12, PyTorch CPU) dan `kp_ingest` (3.14, lewat uv). Tugas DAG memanggil CLI, tidak mengimpor kode pipeline ke proses Airflow. Tanpa Docker socket                                               | Build + `airflow dags list-import-errors` kosong                            |
| 2   | **Database & akun:** role `airflow` + database `airflow` (migrasi infra), `airflow db migrate` sekali jalan, akun admin UI dan akun layanan dari `.env` (`gen-env --add-missing`); UI hanya `127.0.0.1:8081`                                                                              | `infra:check`                                                               |
| 3   | **DAG `harga_harian`:** status kunci → bila terkunci, lewati dengan alasan tercatat; bila terbuka: `kp-pipeline run --steps prepare,collect,preprocess,prices` → `kp_ingest import-pihps` (batas = kunci saat ini) → invalidasi cache (sudah dilakukan ingest) → bersihkan run lama       | Uji DAG (struktur, cabang kunci) + run DAG sungguhan dalam keadaan terkunci |
| 4   | **DAG `latih_ulang`:** run penuh → **kandidat** → daftarkan ke Core API (`POST /internal/model-candidates`, token layanan) dengan metadata dan skor; tidak pernah promosi. Batas 3 run per hari (desain § 4)                                                                              | Uji DAG + run sungguhan `--quick` dalam keadaan terkunci                    |
| 5   | **Core API:** tabel `model_candidates` (run id, batas data, status `pending/approved/rejected`, skor, sha256 bundel), endpoint internal pendaftaran; baca-saja untuk admin (halaman 4C)                                                                                                   | Integrasi                                                                   |
| 6   | **Pembersihan:** `kp-pipeline clean` (hapus run lama dengan aman lewat `remove_run_dir`, simpan kandidat yang belum diputus dan run terakhir yang disetujui)                                                                                                                              | Unit                                                                        |
| 7   | **Kunci terbuka tidak bisa dipalsukan dengan mudah** (temuan 4A ditunda): `REGISTERED.json` asli juga harus diletakkan di samping `OPENED.json`, dan sha256-nya harus sama dengan `registered_file_sha256` di ringkasan repo (OPENED.json ARIF-Net sendiri tidak memuat sidik registrasi) | Unit                                                                        |
| 8   | **Dokumen + audit `fase-4b.md`** (ADR 0016 Airflow, operasi: menyalakan profil, memori)                                                                                                                                                                                                   | —                                                                           |

## Selesai bila

`pnpm audit:all` lulus (ditambah cek infra Airflow), kedua DAG berjalan sungguhan di Airflow dalam keadaan terkunci (harga: dilewati dengan alasan; latih: kandidat `--quick` terdaftar di Core API), dan tinjauan independen tanpa temuan berat/sedang terbuka.
