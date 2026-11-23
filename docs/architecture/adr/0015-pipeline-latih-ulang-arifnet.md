# ADR 0015 — Pipeline latih ulang ARIF-Net dan kunci uji prospektif

- Status: **Diterima** (23 Nov 2026, Fase 4A)
- Terkait: desain Fase 4 (P1–P8), rencana `docs/plans/2026-11-23-fase-4a-pipeline-arifnet.md`, protokol uji prospektif ARIF-Net v1.1.0, ADR 0012 (penerapan ARIF-Net)

## Konteks

Prediksi produk berasal dari ARIF-Net A0 yang dilatih sekali pada data sampai 30 Sep 2026 (ADR 0012). Pemilik ingin pipeline otomatis: ambil harga PIHPS, preprocessing, latih ulang A0 untuk 5 komoditas, lalu bundel prediksi yang diaudit admin. Ada tiga kendala:

- protokol uji prospektif ARIF-Net (DECIDED) melarang pipeline otomatis melatih atau mengevaluasi dengan data sesudah 30 Sep 2026 sebelum pembukaan sekali;
- kode ARIF-Net terbaru ada di folder lokal pemilik, sebagian belum di-commit;
- kode ARIF-Net menghitung semua jalur dari lokasi berkasnya sendiri, tanpa penggantian lewat konfigurasi.

## Keputusan

1. **Salinan kode terkunci** (`services/pipeline/vendor/arifnet`): hanya modul yang dibutuhkan A0 (koleksi PIHPS dan kalender, preprocessing, inti pelatihan, model A0), byte demi byte, dengan `MANIFEST.sha256` yang diverifikasi sebelum setiap run, `SOURCE.md`, dan lisensi MIT. Folder ini dikecualikan dari semua formatter dan linter.
2. **Salinan per run:** setiap run menyalin kode terverifikasi ke foldernya sendiri dan menulis `configs/project.json` di sana: pengaturan riset beku tetap, hanya komoditas (cermin katalog) dan batas data yang diganti. Satu run memuat persis kode, konfigurasi, data, dan bobot yang dipakainya.
3. **Kunci protokol:** repo menyimpan ringkasan registrasi (tanggal dan sha256 konfigurasi beku), bukan `REGISTERED.json` utuh. Selama `OPENED.json` dari ARIF-Net belum ada, atau tidak berupa pembukaan prospektif yang selesai, bukan uji coba, dan dengan konfigurasi beku yang sama, batas data setiap run adalah 30 Sep 2026. Pipeline memaksa `ARIFNET_PHASE=development` agar batas itu dihormati kode ARIF-Net sendiri, dan impor harga ke produk memakai batas yang sama sebagai lapisan kedua.
4. **Gudang bukti mentah permanen:** respons PIHPS mentah (+ sha256) disimpan di luar folder run; collector ARIF-Net hanya mengambil bulan yang belum ada. Riwayat 3 komoditas ≤ 30 Sep 2026 diimpor sekali dari folder lokal ARIF-Net.
5. **Penilaian kandidat dengan metode fold ARIF-Net:** latih sebelum jendela evaluasi (purging), relMAE per komoditas × horizon pada satu tahun origin yang berakhir setahun sebelum batas data, rata-rata 5 seed. Skor ini mengisi `eval_status` produk (keputusan K2) dan halaman audit admin.
6. **Kandidat, bukan rilis:** keluaran run adalah folder model + bundel kandidat. Promosi hanya lewat persetujuan admin (Fase 4C). Verifikator bundel Core API menolak baris komoditas yang belum tercakup model.
7. **Lingkungan latih:** Python 3.12 dan versi pustaka persis dari `requirements-lock.txt` ARIF-Net v1.1.0; PyTorch CPU. `kp_model` menjalankan bundel dari kode sumber layanan model (119 ujinya lulus di 3.12).

## Konsekuensi

- Sebelum pembukaan (paling cepat 3 Des 2026), pipeline hanya menghasilkan kandidat dari data ≤ 30 Sep 2026: cukup untuk membangun, menguji, dan menghadirkan riwayat cabai rawit, tetapi belum memperbarui prediksi.
- Model 5 komoditas adalah model baru (embedding komoditas berbeda dari A0 yang diregistrasi) dan tidak menyentuh registrasi riset ARIF-Net.
- A0 tidak memakai iklim, tetapi `SequenceBank` ARIF-Net selalu membaca berkas iklim: pipeline memasang berkas berisi satu kolom konstan, tanpa mengoleksi iklim.
- Memperbarui salinan kode adalah keputusan eksplisit (salin ulang, `SOURCE.md`, manifest baru).
- Cakupan model produk masih konstanta katalog; mengikutkan cabai rawit setelah persetujuan admin dikerjakan di 4C.
