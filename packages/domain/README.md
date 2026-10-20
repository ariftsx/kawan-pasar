# @kawan-pasar/domain

Aturan perhitungan murni (tanpa I/O, tanpa dependensi runtime). Paket ini dipakai `apps/web` dan `apps/api` supaya modal yang dihitung di perangkat dan di server **selalu identik** (PLAN-08).

| Modul        | Isi                                                                                                           |
| ------------ | ------------------------------------------------------------------------------------------------------------- |
| `cost`       | `calculateMenuCost()`: modal per porsi & per hari (hari ini vs perkiraan), cakupan bahan, margin, porsi bahan |
| `simulation` | `simulatePriceIncrease()`: "kalau satu bahan naik s%", hitungan biasa, bukan model                            |
| `movement`   | `computeWeeklyChanges()`, `computeMovementThreshold()` (Q95 statistik), `isUnusualMovement()`                 |
| `units`      | Konversi takaran resep ke satuan harga (g/kg, ml/l, butir)                                                    |
| `money`      | Pembulatan rupiah half-up yang bebas noise floating point                                                     |
| `result`     | `Result<T>` dan kode error domain                                                                             |

## Aturan penting

- **Bahan tanpa harga bukan Rp 0.** Bahan `coming_soon`/`missing` bernilai `null`, hasilnya `partial`, dan margin tidak dihitung.
- **Pembulatan per baris.** Biaya setiap bahan dibulatkan ke Rp 1 (half-up), lalu total = jumlah baris. Angka yang dilihat pengguna selalu cocok saat dijumlahkan.
- **Error adalah nilai.** Fungsi mengembalikan `Result<T>`, bukan melempar exception, untuk input yang tidak valid.
- **Tanpa data masa depan.** Ambang Q95 hanya memakai perubahan dengan tanggal sebelum tanggal hitung.

## Pengembangan

```bash
pnpm --filter @kawan-pasar/domain test        # Vitest + coverage (ambang 100%)
pnpm --filter @kawan-pasar/domain typecheck
pnpm --filter @kawan-pasar/domain build       # dist/ + deklarasi
```

Contoh resmi di `src/ayam-geprek.fixture.ts` dan test-nya:

- Mode live, 3 komoditas: Rp 3.826 → Rp 3.892 (3 dari 5 bahan).
- DATA DEMO: Rp 10.850 → Rp 10.914.
