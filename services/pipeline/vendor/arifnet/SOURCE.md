# Salinan kode ARIF-Net (Fase 4A)

Salinan sebagian kode ARIF-Net (MIT, lihat `LICENSE`) yang dibutuhkan pipeline Kawan Pasar untuk melatih ulang **ARIF-Net A0** (harga + kalender). Repo ARIF-Net tidak diubah.

- **Sumber:** folder lokal `D:\.Capstone dan TA\ARIF-Net` (keputusan pemilik P7, 23 Nov 2026), karena perubahan terakhir belum di-commit/push.
- **Commit dasar:** `7ae2731f43a1ca6eb4756293ff765826d54daf90` (`release/v1.1-rerun`).
- **Perubahan lokal yang ikut tersalin** (belum ada di commit dasar):
  - `03_training/checkpoint.py` (diubah)
  - `arifnet_core/http.py` (diubah)
  - `results/frozen/arifnet.json` (konfigurasi beku A0, belum terlacak git)
- **Disalin:** 23 Nov 2026, byte demi byte, tanpa perubahan apa pun.

## Isi

| Folder | Berkas | Untuk |
| --- | --- | --- |
| `01_collection/` | `collect_pihps.py`, `collect_calendar.py`, `utils.py` | koleksi harga PIHPS dan kalender libur |
| `02_preprocessing/` | `preprocess_pihps.py`, `build_target.py`, `build_dataset.py`, `utils.py` | data harga bersih, target, dataset fitur harga + kalender |
| `03_training/` | `data.py`, `checkpoint.py`, `trainer.py`, `metrics.py`, `models/neural.py` | inti pelatihan |
| `04_arif_net/` | `model.py`, `train.py` | model dan pelatihan A0 |
| `arifnet_core/` | `settings.py`, `io.py`, `logs.py`, `http.py` | jalur, berkas, log, HTTP |
| `configs/` | `pihps.json`, `calendar_holidays.json`, `http.json`, `project.json` | endpoint PIHPS, libur, aturan HTTP; `project.json` = dasar pengaturan riset beku |
| `results/frozen/` | `arifnet.json` | konfigurasi beku A0 |

Tidak disalin: berita/IndoBERT, iklim, BBM, 13 model pembanding, pencarian, registrasi dan pembukaan uji prospektif. `fit_final.py` diganti `kp_pipeline.fit` (sumber data dan batas waktu sebagai parameter; bagian `env_info`/`_git` yang memerlukan pustaka model pembanding tidak dipakai).

## Integritas

`MANIFEST.sha256` memuat sidik setiap berkas. Pipeline memverifikasinya sebelum setiap run dan menolak jalan bila ada yang berbeda. Folder ini dikecualikan dari Prettier, ESLint, ruff, dan mypy agar tidak pernah diubah oleh alat. Memperbarui salinan adalah keputusan eksplisit: salin ulang dari sumber, perbarui berkas ini, buat ulang manifest.

`configs/project.json` disalin sebagai dasar (target, validasi, ketersediaan, training tetap sama). Di salinan per run, pipeline hanya mengganti komoditas (5, dari katalog), akhir periode, `data_end`, dan `prospective.train_end` (batas data sesuai kunci protokol).
