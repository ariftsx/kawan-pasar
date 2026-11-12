# ADR 0008 — CSP hibrida untuk halaman publik

- Status: **Diterima** (keputusan pemilik, 12 Nov 2026)
- Terkait: desain §6.2, §9; ADR 0009

## Konteks

Desain §9 meminta CSP ketat ber-nonce. Next.js hanya bisa menyisipkan nonce saat halaman dirender per permintaan. Halaman statis/ISR dibuat sekali lalu disajikan ke semua pengunjung, sehingga tidak bisa membawa nonce. Di sisi lain, desain §6.2 meminta halaman publik disajikan dari cache agar tahan beban.

## Opsi

| Opsi                         | Kelebihan                                                                                 | Kekurangan                                                                                                 |
| ---------------------------- | ----------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------- |
| Nonce penuh di semua halaman | Perlindungan XSS terkuat; sesuai teks desain                                              | Setiap kunjungan merender ulang HTML di server; CPU web menjadi titik jenuh; HTML tidak bisa di-cache CDN  |
| **Hibrida** (dipilih)        | Halaman publik statis/ISR (render sekali per pembaruan data); CSP tetap tanpa origin luar | Skrip inline milik Next harus diizinkan; perlindungan terhadap XSS yang menyuntik skrip inline lebih lemah |
| Statis dengan CSP longgar    | Paling sederhana                                                                          | Perlindungan terlemah                                                                                      |

## Keputusan

Halaman publik memakai CSP statis dari `apps/web/src/lib/csp.ts` (dipasang lewat `next.config.ts`):

```
default-src 'self'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline';
img-src 'self' data:; font-src 'self'; connect-src 'self'; object-src 'none'; base-uri 'none';
form-action 'self'; frame-ancestors 'none'; manifest-src 'self'; worker-src 'self'
```

Halaman akun (Fase 2), yang memang dirender per permintaan, akan memakai CSP ber-nonce dengan `'strict-dynamic'`.

### Hasil spike (Task 2 Fase 1B)

1. Dengan `script-src 'self'` saja, browser memblokir 3 skrip inline. Skrip itu adalah payload RSC (`self.__next_f.push(...)`) yang isinya berbeda per halaman dan per revalidasi, jadi hash tidak bisa dihitung sebelumnya. Sesuai cadangan yang sudah disetujui, `'unsafe-inline'` ditambahkan **hanya** pada `script-src`.
2. SRI (`experimental.sri`) hanya terpasang pada sebagian chunk: 5 dari 10 skrip di Turbopack. Build webpack memberi hasil yang sama, jadi ini keterbatasan Next, bukan bundler. SRI hanya bernilai bila skrip dilayani pihak lain (CDN). Di sini semua skrip dilayani origin sendiri, dan pengendali utamanya adalah `script-src 'self'` tanpa origin luar.
3. Konsol browser bersih (tanpa pelanggaran CSP dan tanpa galat hidrasi). Hal ini diperiksa otomatis oleh `tests/e2e/specs/shell.spec.ts` di 6 lebar layar.

## Konsekuensi

- Risiko sisa adalah XSS yang berhasil menyuntik `<script>` inline. Mitigasinya:
  - Halaman publik tidak memantulkan input pengguna.
  - React meng-escape semua teks.
  - Markdown artikel (Fase 1C) dirender ke daftar elemen yang diizinkan, tanpa HTML mentah.
  - Tidak ada `dangerouslySetInnerHTML`.
  - Tidak ada skrip pihak ketiga.
- `'unsafe-eval'` hanya muncul di mode dev (dibutuhkan React untuk debug), tidak pernah di produksi (diuji di `csp.test.ts`).
- Tinjau ulang bila Next mendukung hash untuk payload RSC statis, atau bila halaman publik mulai menerima konten buatan pengguna.
