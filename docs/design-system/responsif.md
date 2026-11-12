# Responsif

Mobile-first. Satu kode untuk semua ukuran; tidak ada deteksi perangkat di server (agar halaman tetap statis dan dapat di-cache).

| Lebar    | Kerangka                                                              | Margin |
| -------- | --------------------------------------------------------------------- | ------ |
| < 640    | TopBar (logo + pasar) + TabBar bawah tetap (5 tab)                    | 16 px  |
| 640–1023 | Sama seperti mobile, dengan kolom lebih lebar                         | 24 px  |
| ≥ 1024   | NavBar atas (5 menu, lonceng peringatan, pemilih pasar), tanpa TabBar | 40 px  |
| ≥ 1280   | Sama, konten maksimal 1280 px                                         | 80 px  |

- **TabBar** memakai `position: fixed`, ditambah `padding-bottom: env(safe-area-inset-bottom)` untuk ponsel berponi. Footer menyisakan ruang yang sama di bawahnya, sehingga tidak ada konten yang tertutup (diuji).
- **TabBar** dibagi 5 kolom sama lebar (`grid-cols-5`), dan label terpotong dengan elipsis bila sempit, sehingga muat di 320 px dan pada teks 200%.
- **NavBar** desktop boleh membungkus ke baris kedua bila teks diperbesar.
- **Target sentuh** minimal 44 × 44 px.
- **Fokus** selalu terlihat: outline 3 px `terong-600`. Tab pertama di setiap halaman adalah "Lewati ke konten".
- **Teks**: kelas ukuran memakai `rem`, judul memakai `text-balance`, dan nama panjang dipotong dengan elipsis di baris mobile.

## Uji (`tests/e2e/specs/shell.spec.ts`)

- Lebar 360, 390, 768, 1024, 1280, 1440 untuk `/`, `/pasar`, `/harga`:
  - Tanpa scroll horizontal.
  - Navigasi yang benar per breakpoint.
  - TabBar tidak menutupi akhir halaman.
  - Tanpa galat konsol (termasuk pelanggaran CSP dan galat hidrasi).
- Reflow 320 px (WCAG 1.4.10) dan teks 200% di 360 dan 1024 px untuk ketiga halaman. Pemeriksaan memakai `clientWidth` (tanpa scrollbar) dan tepi kanan setiap elemen, termasuk elemen `fixed` yang tidak menambah `scrollWidth`.
- axe (WCAG 2.0/2.1/2.2 A dan AA) di 360 dan 1280 px: 0 pelanggaran.
