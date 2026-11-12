# Sistem Desain Kawan Pasar (v0.4 → kode)

Implementasi sistem desain prototipe v0.4 (`figcraft-Kawan_Pasar/`, di luar repo) di `apps/web` dan `packages/tokens`.

| Dokumen                                    | Isi                                                                      |
| ------------------------------------------ | ------------------------------------------------------------------------ |
| [token.md](token.md)                       | Warna, kontras AA, tipografi, font self-host, spasi, radius, breakpoint  |
| [komponen.md](komponen.md)                 | Atom, molekul, organisme, template; aturan props dan data; status sistem |
| [maskot-dan-gerak.md](maskot-dan-gerak.md) | Kapa (7 pose), animasi CSS, `prefers-reduced-motion`, panduan gerak      |
| [responsif.md](responsif.md)               | Breakpoint, kerangka desktop/mobile, target sentuh, uji lebar layar      |

Prinsip:

1. **Performa lebih dulu.** Server Components secara default. Klien hanya untuk interaksi (`NavLinks`, `KapaMotion`, `RetryButton`). Tanpa library UI, ikon, grafik, atau animasi. Hasilnya JS awal sekitar 136 KB terkompresi per rute (anggaran 170 KB).
2. **Satu sumber token.** Warna dan ukuran ada di `packages/tokens`, lalu dibangkitkan menjadi `@theme` Tailwind 4. Palet bawaan Tailwind dimatikan (`--color-*: initial`), jadi kelas warna di luar token tidak bisa dipakai.
3. **Tidak diketahui = "—".** Komponen tidak pernah menampilkan 0 untuk nilai `null`. Ini diuji di setiap komponen yang menampilkan angka.
4. **Informasi tidak bergantung warna.** Arah harga selalu disertai panah, tanda, dan kata untuk pembaca layar.
