# Komponen Atomik

Lokasi: `apps/web/src/components/` (satu komponen per berkas, ekspor bernama), brand di `apps/web/src/brand/`. Uji: `components/components.test.tsx`, `brand/brand.test.tsx`.

## Aturan

- **Atom dan molekul tidak mengambil data** dan tidak memakai `useEffect`. Data diambil di tingkat halaman (Server Component), lalu diturunkan sebagai props bertipe dari `@kawan-pasar/contracts`.
- `'use client'` hanya ada di `NavLinks` (status aktif), `KapaMotion` (animasi), `RetryButton`, dan `error.tsx`.
- Fungsi tidak boleh dijadikan prop dari Server Component ke Client Component. Contohnya, tombol "Coba lagi" di error boundary diberikan sebagai slot (`retry`).
- Setiap target sentuh minimal 44 px (`min-h-11`), termasuk tombol ukuran S.
- Kartu yang seluruhnya bisa diklik memakai satu tautan bernama (nama komoditas) yang direntangkan menutupi kartu.

## Daftar

| Lapis     | Komponen                                                                                                                                                            |
| --------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Brand     | `Logo`, `CommodityIcon` (5), `FeatureIcon` (19), `Illustration` (4), `Kapa` (7 pose), `KapaMotion`                                                                  |
| Atom      | `Button` (5 varian × 3 ukuran), `Chip` (8 tone × 2), `Delta`, `PredictionBadge`, `Sparkline`, `IconBox`, `Price`, `NavItem`, `TabItem`, `HorizonPill`, `Disclaimer` |
| Molekul   | `CommodityCard`, `CommodityRow`, `StatCard`, `MetricCard`, `SectionHeader`, `KataKapa`, `CoverageStrip`, `SelectField`, `MarketPicker`, `StatePanel`                |
| Organisme | `NavBar`, `TopBar`, `TabBar`, `Footer`, `NavLinks`, `SystemState`, `RetryButton`                                                                                    |
| Template  | `SiteShell`, `PageContainer`, `ComingSoonPage`                                                                                                                      |

## Aturan tampilan angka

| Komponen          | Aturan                                                                                                                                                                                             |
| ----------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `Price`           | `Rp 52.400` (spasi tak terputus), Geist Mono tabular; `null` → "—"                                                                                                                                 |
| `Delta`           | Naik: chili + "↑ +3,2%"; turun: hijau + "↓ −1,1%"; perubahan yang dibulatkan menjadi 0,0% disebut "stabil"; `null` → "—"; kata naik/turun/stabil untuk pembaca layar                               |
| `PredictionBadge` | `available`: ★ + median; `expired`: angka + chip "Kedaluwarsa" (wajib); `hidden`/`unavailable`: "Belum tersedia" tanpa angka; `pending_coverage`: "Prediksi menyusul"; `isDemo` → chip "Data demo" |
| `Sparkline`       | SVG server; warna mengikuti perubahan 30 hari; kurang dari 2 titik → garis putus-putus + "Data belum cukup"                                                                                        |
| `CommodityCard`   | `dataStatus: stale` → chip "Terlambat"; tanpa data → "—" + "Data belum tersedia"                                                                                                                   |

## Status sistem (`SystemState`)

| `kind`               | Pose Kapa | Isi                                                    |
| -------------------- | --------- | ------------------------------------------------------ |
| `forecast_pending`   | Istirahat | "Prediksi … belum tersedia" + ke Harga                 |
| `market_unavailable` | Istirahat | "Pasar ini belum tersedia" + kembali ke Kramat Jati    |
| `price_stale`        | Waspada   | "Harga belum diperbarui" + tanggal data terakhir (WIB) |
| `load_failed`        | Waspada   | "Data belum bisa dimuat" + "Coba lagi"                 |
| `coming_soon`        | Istirahat | Halaman fase berikutnya                                |

Status akun (WhatsApp terhubung, belum ada peringatan) menyusul di Fase 2.

## Asal artwork

Logo, ikon, dan ilustrasi di `brand/data/*.tsx` dibangkitkan sekali dari `figcraft-Kawan_Pasar/assets.mjs`: SVG diubah menjadi JSX (atribut camelCase, `id` dibuang). Geometri pose Kapa disalin manual ke `brand/kapa-poses.ts` dan `brand/Kapa.tsx`. Bila prototipe berubah, perbarui berkas itu lalu jalankan `brand.test.tsx`.
