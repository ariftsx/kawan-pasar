# Panduan Kontribusi Kawan Pasar

Dokumen ini adalah aturan kerja yang mengikat seluruh basis kode. Bacalah bersama `docs/design/` dan `docs/README.md`.

## 1. Aturan kepemilikan dan git

1. **Tidak ada atribusi AI/asisten di repositori.** Dilarang menulis baris `Co-Authored-By` untuk alat AI, teks "generated with …", atau penanda serupa di kode, komentar, dokumen, changelog, pesan commit, maupun deskripsi PR. `pnpm audit:all` memindai pelanggaran ini.
2. **Operasi git dijalankan oleh pemilik repositori.** Perubahan disiapkan di working tree, ditinjau, lalu di-commit sendiri oleh pemilik. Tidak ada commit, push, atau pembuatan branch otomatis.
3. Pesan commit mengikuti [Conventional Commits](https://www.conventionalcommits.org/) dalam bahasa Indonesia, misalnya `feat(api): endpoint ringkasan harga`, `fix(web): format rupiah negatif`, `docs: audit fase 1`.

## 2. Kode bersih

- **TypeScript strict tanpa `any`.** Dilarang `any`, `as unknown as`, `@ts-ignore`, `@ts-expect-error`, dan `@ts-nocheck`. Gunakan `unknown` lalu persempit tipenya dengan skema Zod atau type guard.
- Satu berkas satu tanggung jawab. Nama mengungkapkan maksud, dan fungsi dibuat kecil.
- Gunakan `readonly`, union literal, dan exhaustive `switch`. Hindari nilai ajaib: konstanta domain berasal dari `@kawan-pasar/catalog`.
- Galat tidak boleh ditelan diam-diam. Tangani dengan jelas, atau biarkan naik ke filter global.
- Komentar hanya menjelaskan _mengapa_, bukan _apa_.
- Python: `mypy --strict`, `ruff`, dan type hint di semua fungsi.

## 3. Aturan produk yang tidak boleh dilanggar

- Nilai yang tidak diketahui disimpan sebagai `NULL` (atau tidak ada baris) dan ditampilkan sebagai "—". Jangan pernah menampilkannya sebagai 0.
- Prediksi tanpa metadata versi lengkap tidak ditampilkan. Artefak berumur lebih dari 8 hari diberi label kedaluwarsa, dan lebih dari 28 hari disembunyikan.
- Bahasa tidak boleh kausal dan tidak boleh berisi rekomendasi beli/jual. Halaman prediksi selalu memuat pernyataan "prediksi bukan jaminan harga".
- Harga disimpan sebagai integer rupiah.

## 4. Frontend: atomic design

`atoms/` → `molecules/` → `organisms/` → `templates/` → `app/` (halaman). Komponen di bawah tingkat halaman tidak mengambil data sendiri; data turun lewat props bertipe. Server Components menjadi default, dan `"use client"` hanya untuk interaksi.

## 5. Validasi ganda

Setiap masukan divalidasi dua kali dengan **skema yang sama** dari `@kawan-pasar/contracts`: sekali di Next.js (form, Server Action, Route Handler) dan sekali di NestJS (`ZodValidationPipe`). Skema bersifat strict, sehingga properti yang tidak dikenal ditolak.

## 6. Database

- Tidak boleh ada query di dalam loop (N+1). Satu endpoint baca idealnya cukup dengan satu query agregat.
- Semua query terparameterisasi (Drizzle). SQL mentah hanya lewat template `sql\`\``.
- Perubahan skema selalu lewat migrasi yang ditinjau.

## 7. Versi dependensi

Versi dipin tepat (`save-exact`). Versi baru dipakai hanya bila stabil, sudah lolos gerbang umur rilis pnpm (`minimumReleaseAge`), dan peer dependency-nya kompatibel. Pengecualian dicatat sebagai ADR.

## 8. Gerbang mutu

Sebelum meminta tinjauan: `pnpm audit:all` harus lulus. Setiap fase ditutup dengan laporan di `docs/audits/`.
