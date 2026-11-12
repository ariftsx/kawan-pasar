# Konten Artikel Edukasi

Artikel disimpan sebagai berkas Markdown di `content/articles/` dan dimasukkan ke database dengan `pnpm --filter @kawan-pasar/api db:seed:articles` (idempoten, upsert berdasarkan `slug`).

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

1. Tim/pemilik membaca draf di `content/articles/`.
2. Revisi isi seperlunya, lalu ubah `status: draft` menjadi `status: published`.
3. Jalankan `pnpm --filter @kawan-pasar/api db:seed:articles`, lalu `POST /internal/cache/invalidate {"scope":"articles"}` (atau tunggu TTL 6 jam).
4. Commit perubahan konten (oleh pemilik).

`published_at` diisi saat pertama kali terbit dan tidak berubah pada seed berikutnya. Mengembalikan `status` ke `draft` menyembunyikan artikel lagi.

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
