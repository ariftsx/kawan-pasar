# ADR 0012 — Penerapan ARIF-Net A0 di Kawan Pasar

- Status: **Diterima** (19 Nov 2026, Fase 2B Bagian B)
- Terkait: ADR 0006 (bundel demo), kontrak bundel prediksi v1, rencana Fase 2B § 1 dan § 3

## Konteks

1. Tim pemodelan menyelesaikan ARIF-Net v1.1.0 (run ulang penuh 10–17 Nov 2026) beserta retraining final A0 (`results/models/arifnet/`, 5 seed, data latih sampai 30 Sep 2026). Pemilik meminta model itu langsung dipakai bila layak.
2. Kelayakannya sudah dinilai di rencana Fase 2B § 1:
   - bobot cocok dengan model card;
   - data harga identik dengan seed produk;
   - A0 hanya memakai harga dan kalender;
   - relMAE validasi 0,850 (pembanding terbaik BiLSTM 0,863).
     Uji prospektif buta baru dibuka sesudah 30 Nov 2026.
3. Kontrak bundel v1 sudah memisahkan model dari produk: produk hanya membaca bundel berversi yang diverifikasi `promoteBundle`.

## Keputusan

1. **Inferensi saja, dengan numpy.** `services/model-arifnet/src/kp_model` mengimplementasikan ulang forward pass A0 dan seluruh fiturnya:
   - GRU 1 lapis, kepala kejadian, kuantil monoton, dan drift;
   - fitur harga, drift Theil–Sen dan musiman, kalender, standardisasi, urutan harga 60 observasi.
     Tanpa PyTorch dan tanpa pelatihan. Image 64 MB, bukan ±1 GB, dan hanya numpy yang menjadi dependensi runtime.
2. **Kesetaraan dibuktikan, bukan diasumsikan.**
   - `tools/convert_from_arifnet.py` dijalankan sekali di lingkungan riset dan menulis `tests/fixtures/golden.json`. Fixture ini memuat nilai fitur, masukan terstandardisasi, urutan, dan keluaran kelima seed, semuanya dihitung dengan **kode ARIF-Net sendiri** pada seri harga **sintetis**.
   - `tests/test_equivalence.py` mewajibkan hasil numpy sama: fitur ≤ 1e-9 relatif, keluaran ≤ 2e-5.
   - Pada data asli (30 Sep 2026), ke-24 baris kuantil identik dengan keluaran PyTorch.
3. **Bobot tanpa pickle.** Berkas `.pt` dimuat sekali oleh konverter dengan `weights_only=True`, setelah sha256-nya dicocokkan dengan model card. Hasilnya `.npz` berisi array biasa, yang dimuat dengan `allow_pickle=False` dan diperiksa sha256-nya di setiap start (`model/arifnet-a0.json`).
4. **Kontainer sekali jalan `model-export`** (keputusan pemilik K3, profil compose `model`):
   - `network_mode: none`, `read_only`, `cap_drop: ALL`, tanpa env dan tanpa port (dijaga `infra-check`).
   - Ia **tidak punya akses database**. CLI API (`bundle:prices`) mengekspor riwayat harga ke berkas, kontainer menulis satu bundel, lalu `bundle:promote` memverifikasi dan mengaktifkannya.
   - Seluruh alur: `pnpm model:export`.
5. **Ensembel:** kelima seed masing-masing menghasilkan kuantil campuran q10/q50/q90. Kuantil campuran F(x) = (1 − p)·1[x ≥ 0] + p·G(x) memperumum `mixture_median` ARIF-Net ke level lain. Ensembelnya adalah rata-rata per level.
6. **`eval_status`** (keputusan pemilik K2):
   - `available` bila relMAE validasi sel (komoditas × horizon) < 1;
   - `partial` bila ≥ 1, yaitu tidak lebih baik daripada "harga tetap" (beras di hampir semua horizon, cabai dan bawang h1–h3).
   - Halaman ARIF-Net dan Keterbatasan menjelaskan artinya, dan bahwa uji prospektif belum dibuka.
7. **Kalender 2027** (keputusan pemilik K1):
   - Tanggal Ramadan, Idulfitri, dan Iduladha 2027 belum ada di kalender riset.
   - Produk memakai **perkiraan** (1 Ramadan 8 Feb 2027, Idulfitri 10–11 Mar 2027, Iduladha 17 Mei 2027) di `model/calendar_holidays.json` → `_estimated`, sampai tanggal SKB tersedia.
   - Pada data 30 Sep 2026, perkiraan ini tidak mengubah satu angka pun di bundel.
8. **Identitas bundel:**
   - `model_name = arif-net`;
   - `model_version = arifnet-a0-v1.1.0+<sha bobot>`;
   - `data_version = pihps-<tanggal terakhir>-<sha berkas harga>`;
   - `preprocess_version = arifnet-features-v1.1.0`.
     Bundel demo tergeser otomatis (ADR 0006 § 4).

## Konsekuensi

- Pelatihan ulang tetap di repositori ARIF-Net. Setelah retraining, jalankan konverter, lalu uji kesetaraan dan `pnpm model:export`. Konverter menolak bobot yang tidak cocok dengan model card.
- Bila arsitektur berubah (bukan A0), `Network` menolak spesifikasinya, dan `kp_model` harus diperbarui bersama uji golden-nya.
- Prediksi dari 30 Sep 2026 akan tetap sama sampai ada data harga baru (adapter PIHPS, fase berikutnya). Umur bundel mengikuti `issued_at`, jadi ekspor ulang setiap ≤ 8 hari menjaga label "kedaluwarsa" tetap mati.
- Lisensi MIT ARIF-Net beserta atribusinya disalin ke `services/model-arifnet/model/`.
