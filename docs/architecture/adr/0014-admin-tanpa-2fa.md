# ADR 0014 — Halaman admin tanpa 2FA

- Status: **Diterima** (23 Nov 2026, Fase 3B)
- Terkait: desain Fase 3 § 1 (P2–P4) dan § 3, rencana `docs/plans/2026-11-23-fase-3b-admin.md` (K1, K2)

## Konteks

Fase 3B menambah halaman admin untuk memutus pengajuan peran Analis, mencabut peran, memantau impor dan bundel, serta menulis artikel. Pemilik memutuskan admin **tanpa 2FA** (P2). Akibatnya, satu sandi admin yang bocor berarti akses admin penuh. Keputusan ini mengurangi dampaknya sejauh mungkin tanpa faktor kedua.

## Keputusan

1. **Admin hanya dibuat dari server.**
   - `pnpm --filter @kawan-pasar/api admin:grant <email>` dan `admin:revoke <email>`;
   - web tidak pernah memberi atau mencabut admin, dan admin tidak bisa mengubah perannya sendiri atau admin lain;
   - `role:grant` (Fase 3A) tetap menolak menyentuh admin.
2. **Peran dibaca dari basis data pada setiap permintaan** (`AdminGuard`), jadi pencabutan langsung berlaku. Bukan admin → API `403`, web `404` (area admin tidak diumumkan).
3. **Sesi admin lebih pendek dari sesi biasa:**
   - mutlak 12 jam sejak masuk dan diam 2 jam (dihitung dari masuk sampai permintaan admin pertama, lalu dari permintaan admin terakhir);
   - disimpan di kunci Valkey terpisah per sesi (`kp:v1:sadm:<id sesi>`), bukan di rekaman sesi, agar bentuk sesi yang dipakai semua pengguna tidak berubah;
   - kedaluwarsa → seluruh sesi dicabut dan admin harus masuk lagi.
4. **Konfirmasi sandi untuk setiap perubahan:**
   - `POST /v1/admin/confirm` membuka jendela 10 menit; setiap aksi yang mengubah data (`@RequiresConfirmation`) di luar jendela → `403 reauth_required`;
   - sandi salah dihitung ke lockout akun seperti masuk (5 gagal → terkunci);
   - di web, kolom sandi muncul di formulir itu sendiri, bukan halaman terpisah, sehingga artikel panjang yang sedang disunting tidak hilang.
5. **Jejak:** setiap aksi admin (konfirmasi, putusan, pencabutan, simpan, terbit, tarik, pulihkan) tercatat di `audit_log` dalam transaksi yang sama dengan perubahannya, hanya dengan id. Aplikasi tidak bisa menghapus `audit_log` (ADR 0011, Fase 3A).
6. **Email "masuk baru"** ke akun admin setiap kali masuk (perangkat dan waktu WIB, tanpa IP), agar penyalahgunaan sandi segera ketahuan.
7. **Artikel lewat web** (P4, K1, K2):
   - Markdown diperiksa dengan parser yang sama dengan perender publik (`mdast-util-from-markdown`): tautan hanya `https:`, path internal, atau `#`; gambar hanya `https:` dari `ARTICLE_IMAGE_ORIGINS` dan wajib berdeskripsi; HTML mentah ditolak; paling besar 50 KB;
   - setiap simpan menjadi revisi (`article_revisions`; aplikasi hanya SELECT/INSERT), simpan menyebut revisi yang disunting (`409` bila sudah disimpan orang lain), dan revisi lama bisa dipulihkan sebagai simpan baru;
   - seed artikel yang menimpa isi diganti impor awal sekali (`articles:import`), sehingga suntingan web tidak pernah tertimpa berkas;
   - terbit/tarik menghapus cache API dan meminta web memuat ulang dengan kedaluwarsa langsung (`revalidateTag(tag, { expire: 0 })`), sehingga artikel yang ditarik tidak pernah tampil lagi.

## Konsekuensi

- Tanpa 2FA, sandi admin yang bocor tetap berbahaya selama sesi pencuri masih hidup (maks 12 jam). Mitigasi utama: email masuk baru, jejak audit, dan pencabutan sesi dari `/akun`.
- Tabel dan alur dibuat agar TOTP bisa ditambahkan nanti: langkah konfirmasi sudah menjadi satu titik (`reauthenticate`).
- Gambar dari asal luar membuat situs gambar melihat alamat IP pengunjung. Hal ini disebut di kebijakan privasi, dan gambar dimuat tanpa referrer.
