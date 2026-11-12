# Maskot Kapa dan Gerak

## Kapa

Siluet bawang merah sekaligus pin lokasi. Ada 7 pose (`brand/kapa-poses.ts`):

| Pose      | Untuk                                     | Properti      |
| --------- | ----------------------------------------- | ------------- |
| halo      | Sapaan, onboarding, hero                  | —             |
| menunjuk  | Tips ("Kata Kapa")                        | —             |
| prediksi  | Konten ARIF-Net dan prediksi              | grafik        |
| belajar   | Edukasi dan artikel                       | kaca pembesar |
| waspada   | Peringatan harga, gagal memuat            | tanda seru    |
| senang    | Harga turun, aksi berhasil                | kilau         |
| istirahat | Kosong, segera hadir, data belum tersedia | zzz           |

Aturan v0.4:

- Satu Kapa per layar, ukuran 84–200 px (di-clamp oleh komponen).
- Selalu bersama pesan singkat.
- Kapa dekoratif (`aria-hidden`). Bila ia menyampaikan status, beri `label` agar menjadi `role="img"` bernama. Status itu tetap juga ditulis dalam teks.

## Animasi (`brand/kapa.css`)

Meniru 4 frame prototipe (diam → naik + gestur → diam → kedip) dalam satu siklus 3,2 detik. Siklus itu diputar **sekali setiap kali Kapa masuk layar**, bukan berulang tanpa henti: gerakan otomatis yang berjalan lebih dari 5 detik di samping konten wajib bisa dihentikan (WCAG 2.2.2, level A). Prototipe v0.4 memutarnya terus-menerus; ini penyesuaian sadar. Hanya `transform` dan `opacity` yang dianimasikan, jadi aman di GPU dan tidak memicu layout ulang. Kepatuhan pada aturan ini diuji.

| Bagian        | Gerak                                                             |
| ------------- | ----------------------------------------------------------------- |
| Badan (`rig`) | Naik 5 px, 900 ms ease-in-out, lalu turun                         |
| Bayangan      | Menyempit 14% dan memudar saat Kapa naik                          |
| Daun          | Rotasi −5°                                                        |
| Lengan        | Rotasi kecil di bahu (`--kapa-swing` per pose, mis. melambai 12°) |
| Mata          | Kedip `scaleY(0.1)` ±140 ms di akhir siklus                       |
| Properti      | Melayang 4 px dan/atau berdenyut opacity (zzz, kilau, tanda seru) |

Kapan animasi berjalan:

- Hanya bila `KapaMotion` (±1 KB klien) memberi atribut `data-playing` saat Kapa terlihat di layar (IntersectionObserver). Di luar layar, animasi berhenti.
- `prefers-reduced-motion: reduce` → animasi tidak pernah dimulai, dan CSS juga memaksa `animation: none`.
- Tanpa JavaScript, Kapa diam.

## Panduan gerak lain (v0.4)

| Elemen          | Gerak                                    | Status                     |
| --------------- | ---------------------------------------- | -------------------------- |
| Kartu dan baris | Fade + naik 12–16 px, 400 ms, jeda 80 ms | Token tersedia, dipakai 1C |
| Garis prediksi  | Muncul kiri → kanan, 700 ms              | Fase 1C (grafik)           |
| Bubble Kapa     | Fade + naik 8 px, 500 ms, tunda 300 ms   | Fase 1C (hero Beranda)     |

Pengaturan global di `globals.css` mematikan semua animasi dan transisi di bawah `prefers-reduced-motion`.
