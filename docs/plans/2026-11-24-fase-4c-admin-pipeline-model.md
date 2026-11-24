# Rencana Fase 4C — Admin Pipeline dan Model

- Tanggal: 24 November 2026
- Status: **disetujui pemilik 24 Nov 2026** (K1–K4 sesuai usulan)
- Desain: [`docs/design/2026-11-23-fase-4-pipeline-design.md`](../design/2026-11-23-fase-4-pipeline-design.md) § 2–4, § 6 (P4, P5, P8) · Prasyarat: Fase 4B (commit `0aaebf8`)
- Sesudahnya: Fase 5, deployment produksi ke VPS (keputusan pemilik 24 Nov 2026)

## Tujuan

Admin Kawan Pasar memantau dan mengatur pipeline ARIF-Net dari halaman admin, tanpa membuka UI Airflow:

- melihat status kunci uji prospektif dan run terakhir kedua DAG;
- memicu run, menjeda atau melanjutkan DAG, dan mengatur jadwal latih ulang;
- mengaudit kandidat model (gerbang runtime, mutu, dan kewajaran), lalu **menyetujui** (bundel menjadi aktif) atau **menolak** (catatan, lalu latih ulang dipicu).

## Keputusan yang diminta

| #   | Pertanyaan                                      | Usulan                                                                                                                                                                                                                                                                                                                                                                                                                                                                                          |
| --- | ----------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| K1  | Cakupan prediksi per komoditas                  | **Mengikuti bundel ARIF-Net yang aktif**, bukan konstanta katalog. Komoditas yang punya baris di bundel aktif berstatus `covered`; lainnya "menyusul". Verifikator menerima semua komoditas katalog. Halaman web (pemilih komoditas, sitemap) memakai data dari API. Konsekuensinya: setelah bundel 5 komoditas disetujui, cabai rawit langsung tampil prediksinya tanpa ubah kode atau deploy                                                                                                  |
| K2  | Pengaturan jadwal latih ulang                   | **Pilihan jadwal tetap**, disimpan di database Kawan Pasar (dengan audit log): setiap Senin (bawaan), setiap hari, dua minggu sekali (Senin), Senin pertama tiap bulan, atau hanya manual. Jam tetap 02.00 WIB (lalu lintas rendah). DAG `latih_ulang` berjalan setiap hari pukul 02.00, dan tugas pertamanya menanyakan ke Core API apakah hari itu jadwalnya. Cara ini menghindari pembacaan Variable saat parsing (tidak disarankan dokumentasi Airflow) dan tidak menambah hak akun Airflow |
| K3  | Kandidat dari run terkunci (data ≤ 30 Sep 2026) | **Hanya bisa ditolak atau ditandai "verifikasi", tidak bisa disetujui.** Sesuai protokol uji prospektif: sebelum pembukaan, tidak ada model baru yang tampil di produk. Menolak kandidat terkunci tidak memicu latih ulang                                                                                                                                                                                                                                                                      |
| K4  | Penolakan memicu latih ulang                    | **Ya, bila kunci terbuka**, dengan batas 3 run per hari (dicek di Core API dan di DAG). Bila kuota habis, catatan tetap tersimpan dan admin diberi tahu bahwa latih ulang berikutnya mengikuti jadwal                                                                                                                                                                                                                                                                                           |

## Arsitektur

```
Admin web (/admin/pipeline, /admin/model)
   │  BFF Server Actions (sesi admin, CSRF, konfirmasi sandi untuk aksi)
   ▼
Core API  /v1/admin/pipeline/*  /v1/admin/model-candidates/*
   ├─ AirflowClient → http://airflow-api-server:8080 (backend), akun kawanpasar-api, JWT di-cache
   │    status DAG dan run, picu, jeda/lanjut. Bila Airflow mati → "Airflow tidak aktif" (bukan galat 500)
   ├─ promoteBundle (jalur Fase 1/2B) dari /data/pipeline-runs (mount baca-saja)
   └─ /internal/pipeline/schedule, /internal/pipeline/keep-runs (token layanan, untuk DAG)
DAG
   ├─ status_kunci (tiap jam): kp-pipeline status → XCom → dibaca Core API
   └─ latih_ulang (tiap hari 02.00): jadwal? → kunci? → kuota → run → daftar → clean train-* (simpan pending/aktif)
```

## Tugas

| #   | Tugas                                                                                                                                                                                                                                                                                                                                                                                                                                             | Uji                                                                                                                |
| --- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------ |
| 1   | **Cakupan dinamis (K1):** layanan cakupan di Core API dari bundel ARIF-Net aktif (di-cache, dibuang saat promosi). `forecasts`, `prices`, dan kontrak memakai layanan ini. Verifikator: syarat `coverage` menjadi "komoditas ada di katalog". Web: pemilih komoditas, sitemap, dan kartu harga memakai `modelCoverage` dari API                                                                                                                   | Unit + integrasi (bundel 3 komoditas → rawit "menyusul"; bundel 5 → `covered`) + e2e aturan produk                 |
| 2   | **AirflowClient** (Core API): token dengan masa berlaku, batas waktu 5 detik, galat dipetakan ke `airflow_unavailable`. Akses hanya ke DAG `harga_harian`, `latih_ulang`, `status_kunci`. `AIRFLOW_API_URL` dan sandi akun layanan masuk env API                                                                                                                                                                                                  | Unit (server Airflow tiruan)                                                                                       |
| 3   | **DAG `status_kunci`** (tiap jam, tanpa pool, baca-saja) dan perubahan **`latih_ulang`**: jadwal harian 02.00 dengan gerbang jadwal (K2) yang bertanya ke `/internal/pipeline/schedule`, serta `clean --prefix train-` yang menyimpan run kandidat `pending` dan bundel aktif (`/internal/pipeline/keep-runs`)                                                                                                                                    | `check_dags.py` (gerbang jadwal: hari ini/bukan/manual; galat API → gagal terlihat)                                |
| 4   | **API Pipeline (admin):** `GET /v1/admin/pipeline` (status kunci, jadwal, 10 run terakhir per DAG, state per tugas, alasan dilewati), `POST …/trigger` (harga_harian; latih_ulang dengan kuota), `POST …/pause` dan `…/resume`, `PUT …/schedule`. Semua aksi memakai `@RequiresConfirmation` dan `audit_log`                                                                                                                                      | Integrasi (Airflow tiruan)                                                                                         |
| 5   | **API Model (admin):** `GET /v1/admin/model-candidates/:id` (laporan audit: hasil verifikator _dry-run_, gerbang mutu relMAE < 1 dan perbandingan dengan bundel aktif, contoh prediksi per komoditas: median dan rentang h=7/30/90), `POST …/:id/approve` (promoteBundle, kandidat `approved`, kandidat lain yang masih `pending` tetap), `POST …/:id/reject` (catatan, latih ulang menurut K3/K4). Mount `data/pipeline/runs` baca-saja ke `api` | Integrasi: setujui → bundel aktif + revalidasi web; tolak → picu (tiruan); kandidat terkunci → 409; mutu ≥ 1 → 409 |
| 6   | **Web admin:** halaman **Pipeline** (kartu kunci, jadwal, tabel run dengan status berwarna dan alasan, tombol picu/jeda) dan **Model** (daftar kandidat, halaman audit kandidat dengan tabel relMAE komoditas × horizon, contoh prediksi, status gerbang, Setujui/Tolak dengan catatan dan konfirmasi sandi). Bahasa dan pola komponen mengikuti admin 3B                                                                                         | Unit komponen + e2e admin (alur setujui dan tolak dengan tiruan Airflow)                                           |
| 7   | **Simulasi ujung ke ujung** dengan Airflow sungguhan dalam keadaan terkunci: picu `latih_ulang` (verifikasi) dari halaman admin → kandidat muncul → audit → Setujui ditolak karena terkunci → Tolak tersimpan. Lalu simulasi kunci terbuka **di lingkungan uji** (OPENED.json/REGISTERED.json sintetis, hanya di direktori uji dan tidak pernah di `config/prospective`) untuk alur Setujui → prediksi cabai rawit tampil                         | Laporan simulasi + tangkapan layar                                                                                 |
| 8   | ADR 0017 (cakupan dinamis, kendali Airflow dari Core API), dokumen operasi, audit `fase-4c.md`, tinjauan independen, saran commit tanpa atribusi                                                                                                                                                                                                                                                                                                  | 23 gerbang                                                                                                         |

## Keamanan

- Peramban tidak pernah berbicara langsung dengan Airflow. Akun Airflow hanya dipakai Core API di jaringan `backend`.
- Semua aksi admin memerlukan konfirmasi sandi 10 menit (pola 3B) dan tercatat di `audit_log`.
- Persetujuan memakai verifikator dan transaksi promosi yang sama dengan Fase 1/2B (sha256, skema, umur). Bundel aktif tidak pernah tersentuh oleh promosi yang gagal.
- Kandidat terkunci tidak bisa disetujui (dicek di Core API, bukan hanya di UI).
- Mount `data/pipeline/runs` ke `api` bersifat baca-saja. Jalur bundel dibangun dari `run_id` dan `bundle_id` yang sudah divalidasi regex, lalu dicek tetap berada di dalam folder runs.

## Risiko

- **Airflow mati atau profil tidak dijalankan:** halaman Pipeline menampilkan "Airflow tidak aktif". Halaman Model tetap bisa mengaudit dan menyetujui, karena hanya butuh database dan berkas bundel.
- **Umur bundel:** verifikator menolak bundel berumur lebih dari 28 hari. Kandidat yang terlalu lama menunggu ditandai "kedaluwarsa" di laporan audit.
- **Waktu pengerjaan:** 4C menyentuh API, web, DAG, dan e2e. Perkiraan setara 3B.
