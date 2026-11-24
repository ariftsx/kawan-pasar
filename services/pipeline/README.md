# kp-pipeline — pipeline latih ulang ARIF-Net A0 (Fase 4)

Mengambil harga PIHPS, menjalankan preprocessing ARIF-Net, melatih ulang **ARIF-Net A0** (harga + kalender) untuk 5 komoditas, menilainya, lalu membuat **bundel kandidat**. Kandidat tidak pernah dipromosikan otomatis: admin mengaudit dan menyetujuinya (Fase 4C).

Desain: [`docs/design/2026-11-23-fase-4-pipeline-design.md`](../../docs/design/2026-11-23-fase-4-pipeline-design.md) · Rencana: [`docs/plans/2026-11-23-fase-4a-pipeline-arifnet.md`](../../docs/plans/2026-11-23-fase-4a-pipeline-arifnet.md).

## Langkah satu run

| Langkah      | Isi                                                                                                                                                                                                    |
| ------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `prepare`    | Salin kode ARIF-Net (`vendor/arifnet`, dicek `MANIFEST.sha256`) ke folder run, tulis `project.json` (5 komoditas, batas data dari kunci protokol), tautkan gudang bukti mentah, berkas iklim pengganti |
| `collect`    | `collect_calendar`, `collect_pihps full` (hanya bulan yang belum ada di gudang), `collect_pihps verify`                                                                                                |
| `preprocess` | `preprocess_pihps`, `build_target`, `build_dataset` (kode ARIF-Net apa adanya)                                                                                                                         |
| `prices`     | `prices_pihps.csv` (untuk `kp_ingest import-pihps`) dan `prices_model.csv` (untuk `kp_model`), ≤ batas data                                                                                            |
| `train`      | Penilaian: 5 seed pada jendela evaluasi (metode fold ARIF-Net); latih final 5 seed; konversi ke `.npz` + spesifikasi                                                                                   |
| `bundle`     | `kp_model` membuat bundel prediksi kandidat                                                                                                                                                            |

`run.json` mencatat status kunci, batas data, dan setiap langkah. Run yang terputus dilanjutkan dengan run id yang sama. Run tidak boleh dilanjutkan di lingkungan lain (Windows ↔ kontainer), karena tautan gudangnya berbeda.

## Kunci uji prospektif

Protokol ARIF-Net v1.1.0 melarang pipeline otomatis melatih atau mengevaluasi dengan data sesudah 2026-09-30 sebelum pembukaan resmi. Selama `config/prospective/OPENED.json` belum ada, batas data setiap run adalah 2026-09-30. Kunci terbuka hanya bila berkas itu (dari `results/prospektif/OPENED.json` ARIF-Net) adalah pembukaan prospektif yang selesai, bukan uji coba, dengan konfigurasi beku yang sama dengan registrasi (`config/prospective/registration.json`). Sejak Fase 4B, `REGISTERED.json` asli dari ARIF-Net (`results/prospektif/REGISTERED.json`) juga wajib diletakkan di sampingnya, dengan sha256 yang sama dengan `registered_file_sha256` di ringkasan registrasi. Kedua berkas di-gitignore karena memuat info mesin peneliti, tidak pernah masuk image, dan dipasang baca-saja.

## Perintah

```sh
pnpm pipeline status              # status kunci
pnpm pipeline run [--quick]       # satu run di kontainer (--quick = 1 epoch, hanya untuk uji)
pnpm pipeline import <run-id>     # impor harga run itu ke produk (batas data = kunci saat ini)

# Dipakai oleh DAG Airflow (Fase 4B):
kp-pipeline register --run <folder-run>              # daftarkan kandidat ke Core API (API_INTERNAL_URL, SERVICE_TOKEN dari env)
kp-pipeline runs-today --runs <folder> --prefix train-   # jumlah run hari ini (WIB), untuk batas 3/hari
kp-pipeline clean --runs <folder> --keep-latest 10   # hapus run lama (gudang tidak pernah ikut terhapus)

# Lokal (Windows), dari services/pipeline:
uv run kp-pipeline seed --arifnet "D:\.Capstone dan TA\ARIF-Net" --store ../../data/pipeline/store
uv run kp-pipeline run --store ../../data/pipeline/store --runs ../../data/pipeline/runs
```

Gudang dan run ada di `data/pipeline/` (di-gitignore). **Jangan** menghapus folder run dengan `rm -rf` di Windows sebelum melepas tautan `arifnet/data/raw/pihps` (junction): lepas dulu dengan `os.rmdir`, agar gudang tidak ikut terhapus.

## Apache Airflow (Fase 4B)

Pipeline dijadwalkan dan dipantau di Apache Airflow 3.3.2 (ADR 0016). Profilnya terpisah dari stack produk, dan definisinya ada di `airflow/`.

| DAG            | Jadwal (WIB)      | Langkah                                                                                      |
| -------------- | ----------------- | -------------------------------------------------------------------------------------------- |
| `harga_harian` | Senin–Jumat 10.00 | kunci → `run --steps prepare,collect,preprocess,prices` → `kp_ingest import-pihps` → `clean` |
| `latih_ulang`  | Senin 02.00       | kunci → kuota (maks 3/hari) → run penuh → `register` (kandidat `pending`)                    |

- Selama kunci uji prospektif tertutup, run terjadwal **dilewati** (_skipped_) dengan alasannya di log tugas. Status ini diharapkan, bukan kegagalan.
- `latih_ulang` dapat dipicu manual dengan parameter `even_if_locked` (verifikasi, data ≤ 2026-09-30) dan `quick` (1 epoch, hanya uji).
- Setiap langkah adalah panggilan CLI ke venv masing-masing (`/opt/pipeline` Python 3.12, `/opt/ingest` Python 3.14). Pengaturan `AIRFLOW__*` dan `PYTHONPATH` dihapus dari lingkungan langkah.
- Kredensial diberikan per langkah:
  - `register` hanya menerima `API_INTERNAL_URL` dan `SERVICE_TOKEN`;
  - `import-pihps` menerima `INGEST_DATABASE_URL` (ditambah URL dan token Core API untuk membuang cache harga);
  - run pipeline, termasuk kode ARIF-Net yang mengakses internet, tidak menerima kredensial apa pun.
- Pool Airflow `kp_store` (1 slot, dibuat `airflow-init`) menjaga agar hanya satu langkah yang menulis ke gudang bukti dan folder run, lintas kedua DAG.
- `clean` hanya menghapus run `prices-*` (10 terbaru disimpan). Run `train-*` menyimpan bundel kandidat yang menunggu audit admin, sehingga tidak dihapus di 4B. Pembersihan menurut status kandidat dikerjakan di 4C.
- Pendaftaran kandidat bersifat idempoten. Run dan bundel yang persis sama dijawab 200 dengan id lama, sedangkan run id atau bundel id yang sudah dipakai pendaftaran lain dijawab 409, yang dianggap galat.
- Bila tugas dihentikan (batas waktu atau ditandai gagal), seluruh grup proses langkah ikut dihentikan.
- `airflow/check_dags.py` memeriksa DAG di dalam image: lolos import, jadwal, zona waktu, urutan tugas, pool, `catchup=False`, dan `max_active_runs=1`. Pemeriksa juga memanggil tugas gerbang dengan status kunci tiruan: dilewati saat terkunci, `even_if_locked` hanya bila diminta, dan berhenti pada run ke-3 dalam sehari.

```sh
node scripts/gen-env.mjs --add-missing   # sekali: rahasia Airflow (role DB, admin UI, akun API, JWT, Fernet)
pnpm airflow:up                          # UI dan REST API di http://127.0.0.1:8081 (pengguna admin)
pnpm airflow:down
docker run --rm --entrypoint python kawan-pasar/airflow:local /opt/airflow/check_dags.py   # Git Bash: awali dengan MSYS_NO_PATHCONV=1
```

Sandi `admin` ada di `.env` (`AIRFLOW_ADMIN_PASSWORD`). Akun `kawanpasar-api` (peran `user`) disiapkan untuk Core API di 4C. Selalu nyalakan Airflow lewat `pnpm airflow:up` (wrapper `scripts/compose.mjs`). Menjalankan `docker compose` dengan set berkas lain akan membuat ulang PostgreSQL tanpa port dev-tools.

Kebutuhan memori: Docker Desktop 6 GB. Pada backend WSL2, atur di `%UserProfile%\.wslconfig` (`[wsl2]`, `memory=6GB`), lalu jalankan `wsl --shutdown`. Run uji `quick` memakai puncak sekitar 1 GB di scheduler; run penuh sekitar 3 GB (batas kontainer 4 GB).
