# Token Desain

Sumber: `packages/tokens/src/` (diuji di `tokens.test.ts`). Build menghasilkan `dist/theme.css`, yang diimpor `apps/web/src/app/globals.css`.

## Warna

Palet "Brand v0.4" disalin persis dari prototipe:

| Token                              | Nilai                             | Pakai untuk                                          |
| ---------------------------------- | --------------------------------- | ---------------------------------------------------- |
| `canvas` / `surface` / `surface-2` | `#FAF7F0` / `#FFFFFF` / `#F3EFE6` | Latar halaman / kartu / isian, chip netral           |
| `ink` / `ink-2`                    | `#14201A` / `#4A5750`             | Teks utama / teks pendukung                          |
| `muted`                            | `#7C877F`                         | **Hanya** teks besar (≥ 18,66 px tebal), garis, ikon |
| `line`                             | `#E8E2D6`                         | Garis tepi                                           |
| `green-900` / `600` / `100`        | `#0E4D35` / `#17865A` / `#E3F2E9` | Brand, footer / grafik turun / latar chip hijau      |
| `chili-600` / `100`                | `#E04535` / `#FDE7E3`             | Grafik naik, Kapa / latar chip naik                  |
| `kunyit-500` / `100`               | `#F0A92E` / `#FDF1D8`             | Tombol utama / latar Kata Kapa, chip "Terlambat"     |
| `terong-600` / `100`               | `#6A4BD6` / `#EEE9FD`             | Prediksi, fokus / latar chip prediksi                |
| `shallot-500`                      | `#B8325E`                         | Aksen bawang merah                                   |

**Tambahan (bukan v0.4)**, untuk teks kecil yang lolos AA:

| Token        | Nilai     | Menggantikan, untuk teks kecil                       |
| ------------ | --------- | ---------------------------------------------------- |
| `muted-text` | `#5F6B63` | `muted` (3,49:1 di `canvas`, gagal AA)               |
| `green-700`  | `#127048` | `green-600` di `green-100` (3,95:1)                  |
| `chili-700`  | `#B23628` | `chili-600` di `chili-100` (3,49:1); warna kaki Kapa |

`TEXT_PAIRS` mendaftar setiap pasangan teks/latar yang dipakai UI. Uji memastikan pasangan teks biasa ≥ 4,5:1 dan teks besar/ikon ≥ 3:1. `TEXT_PAIRS_FORBIDDEN` mendaftar pasangan v0.4 yang dilarang untuk teks kecil, dan uji membuktikan pasangan itu memang gagal.

Warna di dalam artwork (logo, Kapa, ikon, ilustrasi) tetap berupa nilai literal di `apps/web/src/brand/`, karena itu bagian dari gambar dan bukan warna UI.

## Tipografi

- **Plus Jakarta Sans** (teks) dan **Geist Mono** (angka harga, `tabular-nums`). Keduanya berlisensi SIL OFL 1.1 (`apps/web/src/brand/fonts/OFL.txt`).
- Di-self-host lewat `next/font/local`, `display: swap`. Geist Mono tidak di-preload.
- Font disubset ke Latin + Latin Extended-A dan beberapa simbol (– — ‘ ’ “ ” • … ′ € ↑ ↓ → − ★ ×). Hasilnya Plus Jakarta Sans 26 KB dan Geist Mono 22 KB (variabel, WOFF2). Cara membuat ulang:

  ```bash
  U="U+0000-00FF,U+0100-017F,U+2013-2014,U+2018-201D,U+2022,U+2026,U+2032,U+20AC,U+2191,U+2193,U+2192,U+2212,U+2605,U+00D7"
  uvx --from "fonttools[woff]" pyftsubset figcraft-Kawan_Pasar/fonts/PlusJakartaSans-VF.ttf \
    --unicodes="$U" --flavor=woff2 --layout-features='kern,liga,tnum,lnum' \
    --output-file=apps/web/src/brand/fonts/PlusJakartaSans-latin.woff2
  uvx --from "fonttools[woff]" pyftsubset figcraft-Kawan_Pasar/fonts/GeistMono-VF.ttf \
    --unicodes="$U" --flavor=woff2 --layout-features='kern,tnum,lnum' \
    --output-file=apps/web/src/brand/fonts/GeistMono-latin.woff2
  ```

- Skala tipe: 16 gaya v0.4 menjadi kelas Tailwind `text-<gaya>`, misalnya `text-heading-h2-32`, `text-body-small-13`, `text-numeric-m-24`. Setiap gaya membawa ukuran (rem), tinggi baris, letter-spacing, dan ketebalan.

## Spasi, radius, breakpoint

- Grid 8 pt (4–80).
- Radius: `sm 8`, `md 14`, `lg 20`, `xl 24`, `2xl 32`, `full`.
- Breakpoint: `sm 640`, `lg 1024`.
- Konten maksimal 1280 px (lihat [responsif.md](responsif.md)).
