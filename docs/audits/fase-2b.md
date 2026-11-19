# Audit Fase 2B — Tindak Lanjut Akun, ARIF-Net, dan Peringatan

- Tanggal: 19 November 2026
- Rencana: [`docs/plans/2026-11-19-fase-2b-arifnet-dan-peringatan.md`](../plans/2026-11-19-fase-2b-arifnet-dan-peringatan.md) (K1–K3 diputuskan pemilik)
- ADR baru: [0012 — Penerapan ARIF-Net A0](../architecture/adr/0012-penerapan-arif-net.md)
- Status: **20/20 gerbang lulus** (lihat § 2 tentang Docker Desktop di tengah audit kedua)

## 1. Yang dihasilkan

| Bagian         | Hasil                                                                                                                                                                                                                                 |
| -------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| A — Akun       | Nomor HP opsional (AES-256-GCM, tersamar, ubah/hapus di `/akun`), konfirmasi kata sandi, tombol lihat/sembunyikan di semua isian sandi                                                                                                |
| B — ARIF-Net   | Prediksi dari ARIF-Net A0 v1.1.0 (bukan demo). Inferensi numpy di kontainer `model-export` tanpa jaringan/DB, `pnpm model:export`. Halaman ARIF-Net dan Keterbatasan memuat skor validasi v1.1 per komoditas × horizon                |
| C — Peringatan | `/peringatan`: daftar pantau + batas harga, 3 aturan, kabar dengan tab, tandai dibaca. Evaluasi berkelompok di worker, idempoten. Ringkasan mingguan Senin 06.00 WIB (aplikasi + email) dengan tautan berhenti berlangganan satu klik |

## 2. Gerbang mutu (`pnpm audit:all`)

| Gerbang                                                                                                                                                                                                  | Hasil                                                                                                                                                               |
| -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| format, lint, typecheck, unit-tests, web-build, stack-rebuild, infra (40), integration-tests, ingest (pytest, mypy, ruff), model (pytest ≥ 90%, mypy, ruff), dependency-audit, no-any, no-ai-attribution | ✔ audit kedua                                                                                                                                                       |
| e2e-smoke, lighthouse, test-db-reset, ingest-tests                                                                                                                                                       | ✔ diulang dengan perintah yang sama setelah Docker Desktop berhenti di tengah e2e audit kedua (galat 500 dari engine, bukan galat uji): e2e 304/304, Lighthouse 7/7 |

Audit pertama gagal di 2 gerbang, keduanya diperbaiki:

- format: dua skrip belum dirapikan; berkas hasil konverter model kini di `.prettierignore`.
- integration: uji 2A "10 percobaan masuk per menit" melewati pergantian menit (jendela tetap pada jam asli). Uji kini menghindari 5 detik terakhir sebuah menit.

| Paket         | Uji                                                                                                                |
| ------------- | ------------------------------------------------------------------------------------------------------------------ |
| api           | 94 unit + 179 integrasi (HP, peringatan, evaluator tanpa N+1, ringkasan mingguan + pemulihan, worker, IDOR)        |
| web           | 227 unit + 2 integrasi                                                                                             |
| contracts     | 40                                                                                                                 |
| model-arifnet | 119 (96 kesetaraan dengan kode ARIF-Net), cakupan 96,5%                                                            |
| e2e           | 304 (termasuk peringatan di 360/1280 px, axe, tanpa JS, CSP; HP; tombol mata; konfirmasi sandi; status "Sebagian") |
| Lighthouse    | 7 halaman publik dalam anggaran (LCP ≤ 1,13 s, TBT ≤ 181 ms, JS ≤ 144 KB, a11y 100)                                |

## 3. Simulasi pengguna akhir

| Perjalanan                                                                                                                       | Hasil |
| -------------------------------------------------------------------------------------------------------------------------------- | ----- |
| Daftar dengan HP + konfirmasi sandi → masuk → HP tersamar di `/akun` → ubah → hapus                                              | ✔     |
| Tombol mata di daftar, masuk, atur ulang; tanpa JS tidak ada tombol                                                              | ✔     |
| Prediksi tanpa label demo, versi `arifnet-a0-v1.1.0+…`; beras h7 "Sebagian", h30 "Tersedia"                                      | ✔     |
| Pantau bawang di atas Rp 39.000 → impor harga → kabar muncul (sekali, juga setelah impor ulang) → tandai dibaca → "Lihat detail" | ✔     |
| Pengaturan disimpan dan tetap setelah muat ulang; tanpa JS memantau tetap bisa                                                   | ✔     |
| `/peringatan` tanpa sesi → masuk → kembali; halaman privat dengan CSP ber-nonce                                                  | ✔     |

## 4. Temuan selama pelaksanaan (diperbaiki, dengan uji)

1. `//evil.example` lolos pola tautan kabar (URL tanpa skema). Kini ditolak di kontrak dan CHECK database.
2. Baris "WhatsApp · segera hadir" ber-`opacity` gagal kontras AA (3,59:1). Diganti status berchip.
3. Fungsi bantu yang diekspor dari modul `'use server'` akan menjadi endpoint publik. Dipindah ke modul biasa.
4. Kalender model mengabaikan `KP_MODEL_DIR` (hanya terlihat di kontainer).
5. Path berspasi terpecah saat `pnpm` dijalankan lewat shell Windows. Berkas harga sempat tertulis ke `D:\.Capstone` dan langsung dihapus. Kini memakai path relatif.
6. CLI bundel: `process.exit` setelah promosi berhasil memicu assertion libuv di Windows (exit ≠ 0). Kini `process.exitCode`.

## 5. Tinjauan independen (baca-saja)

- **Critical:** tidak ada.
- **Important (diperbaiki):**
  1. Ringkasan mingguan bisa kehilangan email tanpa pulih. Kini per pengguna: gagal antre → penanda minggu dihapus, job gagal di akhir, lalu BullMQ mengulang (3×) dan hanya mengirim yang terlewat.
  2. Impor beruntun mengantrekan evaluasi penuh berulang. Kini digabung (`deduplication` + `keepLastIfActive`): perubahan saat evaluasi berjalan tetap menghasilkan tepat satu evaluasi lanjutan.
  3. Penyimpangan dari rencana belum tercatat. Kini di buku catatan (C-1…C-10) dan § 6.
- **Minor diperbaiki:** sisa direktori `.tmp` ekspor yang terputus; `--now` wajib berzona waktu; "Tandai semua dibaca" tetap di tab yang sama.
- **Minor ditunda:**
  - batas 20 pantauan bisa terlewati oleh permintaan bersamaan;
  - nomor HP belum punya id kunci (rotasi kunci, untuk 2C);
  - tanggal dasar bisa berbeda antarkomoditas dalam satu bundel;
  - folder `artifacts` dipasang baca-tulis di kontainer.

## 6. Keputusan pelaksanaan (rulings)

Rinciannya di buku catatan. Ringkasnya:

- **ARIF-Net:**
  - inferensi numpy, bukan PyTorch (image 64 MB, tanpa pickle);
  - fixture uji dari seri sintetis (data pasar tidak di-commit);
  - pada data asli 24/24 baris identik dengan PyTorch.
- **Skor:**
  - relMAE gabungan A0 0,850 (BiLSTM 0,863), bukan 0,933 seperti yang sempat tertulis di rencana (itu metrik lain);
  - Laporan v04 Tabel 4.5 masih memuat run v1.0.
- **Peringatan:**
  - model data mengikuti prototipe (sakelar global + daftar pantau);
  - kabar peringatan hanya di aplikasi; email hanya untuk ringkasan mingguan;
  - pantauan hanya mengabarkan data sesudah dibuat;
  - lonceng tanpa lencana jumlah: jumlah tampil di `/peringatan` dan `/akun`, supaya halaman publik tetap tanpa JS per pengguna.
- **Advisory `picomatch`:** dicabut GitHub (18 Nov). Tidak ada pengecualian audit.

## 7. Uji beban

Rincian di `docs/testing/uji-beban.md`.

- Evaluasi 15.039 pantauan: 1,6–2,4 s, atau 10,7 s saat membuat 5.000 kabar.
- Selama evaluasi terus-menerus, halaman publik tetap tanpa galat.
- **Anggaran p95 < 500 ms tidak dapat dinilai di sesi ini.** _Baseline_ sendiri 1,9–3,0 s karena host terbebani. Perlu diulang di mesin yang tenang.

## 8. Tangkapan layar

| Halaman                              | 360 px                                               | 1280 px                                                |
| ------------------------------------ | ---------------------------------------------------- | ------------------------------------------------------ |
| Peringatan                           | [peringatan-360](fase-2b/peringatan-360.png)         | [peringatan-1280](fase-2b/peringatan-1280.png)         |
| Daftar (HP, konfirmasi, tombol mata) | [daftar-360](fase-2b/daftar-360.png)                 | [daftar-1280](fase-2b/daftar-1280.png)                 |
| Akun (HP, peringatan)                | [akun-360](fase-2b/akun-360.png)                     | [akun-1280](fase-2b/akun-1280.png)                     |
| ARIF-Net                             | [arif-net-360](fase-2b/arif-net-360.png)             | [arif-net-1280](fase-2b/arif-net-1280.png)             |
| Prediksi beras ("Sebagian")          | [prediksi-beras-360](fase-2b/prediksi-beras-360.png) | [prediksi-beras-1280](fase-2b/prediksi-beras-1280.png) |

## 9. Catatan untuk pemilik

1. Perbarui Laporan v04 Tabel 4.5 ke hasil ARIF-Net v1.1.0 (halaman produk sudah memakai v1.1).
2. Ganti perkiraan hari raya 2027 dengan tanggal SKB bila sudah terbit (`services/model-arifnet/model/calendar_holidays.json`, lalu `pnpm model:export`).
3. Setelah uji prospektif dibuka (sesudah 30 Nov 2026), skor uji akhir dapat menggantikan skor validasi di halaman ARIF-Net.
4. Ekspor ulang bundel paling lambat setiap 8 hari (`pnpm model:export`), supaya prediksi tidak berlabel "kedaluwarsa".
5. Masih terbuka dari fase lama: 5 draf artikel, `PUBLIC_SITE_URL` produksi (wajib https).
