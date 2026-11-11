# services/model-arifnet

> **Belum dikembangkan.** Model ARIF-Net dikerjakan di repositori tim pemodelan. Layanan ini nantinya
> hanya **menyajikan artefak** (bundel prediksi berversi), tidak melatih atau menjalankan eksperimen model.

## Peran (saat dikembangkan)

- Layanan FastAPI yang hanya bisa diakses di jaringan internal (`backend`), tidak pernah melalui Traefik.
- Setiap permintaan dari Core API wajib bertanda tangan HMAC-SHA256 (lihat kontrak di bawah).
- Memuat bundel aktif dari `artifacts/`, memeriksa kesegaran (lebih dari 8 hari = kedaluwarsa, lebih dari 28 hari = disembunyikan) dan kelengkapan metadata versi sebelum mengembalikan prediksi.

## Kontrak

Kontrak lengkap (struktur bundel, aturan verifikasi, tanda tangan HMAC) ada di
[`docs/data/kontrak-bundel-prediksi.md`](../../docs/data/kontrak-bundel-prediksi.md). Kontrak itu
mengikat tim produk dan tim pemodelan. Perubahan harus disepakati kedua tim dan dicatat sebagai ADR.

## Struktur

```
services/model-arifnet/
├─ pyproject.toml      dependensi dideklarasikan saja (belum dipasang/dijalankan)
├─ src/kp_model/       kode layanan (kosong)
├─ tests/              uji (kosong)
└─ artifacts/          tempat bundel dikirim pipeline (tidak di-commit)
```

Selama layanan ini belum ada, halaman Prediksi memakai bundel demo berlabel "Data demo" (Fase 1).
