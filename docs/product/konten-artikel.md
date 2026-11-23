# Konten Artikel Edukasi

Sejak Fase 3B (ADR 0014), artikel dikelola di halaman admin (`/admin/artikel`): sunting Markdown, pratinjau, terbitkan atau tarik, dan pulihkan revisi lama. Berkas di `content/articles/` hanya isi awal: `pnpm --filter @kawan-pasar/api articles:import` memasukkannya sekali ke database yang masih kosong, dan menolak berjalan bila sudah ada artikel, sehingga suntingan di web tidak pernah tertimpa.

## Format berkas

```markdown
---
slug: pola-musiman-harga-pangan # huruf kecil, angka, tanda hubung
category: dasar # dasar | prediksi | arif-net | keterbatasan
title: Pola musiman harga pangan
summary: Satu kalimat ringkasan (≤ 500 karakter).
readingMinutes: 5
status: draft # draft | published
order: 3 # urutan tampil (naik)
---

Isi Markdown…
```

Bila satu berkas tidak valid, seed **dibatalkan seluruhnya** dan galatnya menyebut nama berkas serta field yang salah.

## Alur tinjau (draf → terbit)

1. Admin membuka `/admin/artikel`, menyunting draf, lalu memeriksa pratinjau (perender yang sama dengan halaman publik).
2. Simpan. Setiap simpan menjadi revisi baru; bila orang lain sudah menyimpan sejak halaman dibuka, simpan ditolak agar tidak saling menimpa.
3. Terbitkan. Artikel langsung tampil di Edukasi (cache API dihapus dan halaman web kedaluwarsa saat itu juga). Tarik untuk menyembunyikannya lagi.
4. Perubahan yang keliru dipulihkan dari riwayat revisi.

Aturan isi: tautan hanya `https://`, path internal (`/harga`), atau `#bagian`; gambar `![deskripsi](https://…)` hanya dari asal di `ARTICLE_IMAGE_ORIGINS` (bawaan `upload.wikimedia.org`, `images.unsplash.com`; domain tim ditambahkan di `.env`, lalu web dibangun ulang); HTML tidak didukung; paling besar 50 KB.

## Pedoman bahasa (wajib)

- **Tidak kausal:** pakai "sering tercatat", "cenderung", "beriringan dengan". Hindari "karena", "menyebabkan", atau "akibat" untuk pergerakan harga.
- **Tanpa rekomendasi transaksi:** jangan menyuruh membeli atau menjual pada waktu tertentu.
- **Prediksi = estimasi**, bukan jaminan.
- **Tanpa angka harga statis.** Contoh data di halaman dirender dari API (Fase 1C). Angka ilustratif boleh asal jelas ilustratif.
- **Rujukan lembaga** (BPS, Bank Indonesia, BMKG) untuk klaim faktual.

## Status saat ini (12 Nov 2026)

| Urutan | Slug                        | Status                              |
| ------ | --------------------------- | ----------------------------------- |
| 1      | `apa-itu-inflasi-pangan`    | **published** (teks prototipe v0.4) |
| 2      | `inflasi-pangan-bergejolak` | draft, menunggu tinjauan            |
| 3      | `pola-musiman-harga-pangan` | draft, menunggu tinjauan            |
| 4      | `cuaca-pasokan-distribusi`  | draft, menunggu tinjauan            |
| 5      | `membaca-prediksi-harga`    | draft, menunggu tinjauan            |
| 6      | `menyusun-anggaran-belanja` | draft, menunggu tinjauan            |
