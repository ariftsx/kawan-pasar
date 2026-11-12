# ADR 0005 — Token layanan, rate limit berlapis, dan proxy tepercaya

- **Status:** Diterima (12 Nov 2026)

## Konteks

Core API hanya boleh dipanggil oleh Next.js (BFF) dan job internal. Rate limit per klien harus memakai alamat klien asli, tetapi alamat itu hanya diketahui lewat `X-Forwarded-For` yang dikirim proxy. Header itu mudah dipalsukan bila sembarang pengirim dipercaya. Tinjauan Fase 0 (M4) mencatat bahwa `trustProxy` masih mencakup seluruh RFC1918.

## Keputusan

1. **Token layanan** di header `x-service-token` wajib untuk semua rute kecuali yang ditandai `@Public()` (hanya `/health/*`). Perbandingan dilakukan atas digest SHA-256 dengan `timingSafeEqual`, sehingga panjang maupun isi token tidak bocor lewat waktu respons.
2. **Proxy tepercaya** = daftar IP eksplisit `TRUSTED_PROXY_IPS`. Di compose isinya hanya `172.30.0.10` (kontainer web), di subnet backend tetap `172.30.0.0/24`. Alokasi dinamis Docker dibatasi ke `172.30.0.128/25`, sehingga alamat tetap (< .128) tidak pernah dipakai kontainer lain. Bila daftar kosong, tidak ada yang dipercaya dan `request.ip` = alamat soket.
3. **Rate limit berlapis**:
   - Lapis 1, Traefik: 50 req/detik per IP (burst 100) dan 100 permintaan serentak.
   - Lapis 2, API: fixed window 60 detik per `(controller, IP klien)` di Valkey (`MULTI INCR/EXPIRE`), default 120/menit (`RATE_LIMIT_PER_MINUTE`). Bila terlampaui → 429 + `Retry-After`.
4. **Fail-open** bila Valkey tidak tersedia. Permintaan tetap dilayani dan peringatan dicatat di log. Alasannya, ketersediaan lebih penting, dan lapis Traefik tetap aktif.
5. **Format galat seragam** lewat `ApiExceptionFilter`. Pesan framework, input mentah, dan stack tidak pernah dikirim ke klien.

## Opsi yang dipertimbangkan

| Opsi                                             | Kelebihan                                   | Kekurangan                                              |
| ------------------------------------------------ | ------------------------------------------- | ------------------------------------------------------- |
| `@nestjs/throttler` + storage Redis pihak ketiga | Fitur lengkap                               | Dependensi tambahan; storage pihak ketiga perlu diaudit |
| Guard sendiri (dipilih)                          | ±60 baris, teruji, perilaku fail-open jelas | Hanya fixed window (cukup untuk lapis kedua)            |
| Fail-closed saat Valkey mati                     | Lebih ketat                                 | Gangguan cache menjadi gangguan layanan penuh           |

## Konsekuensi

- Kontainer web (Fase 1B) **wajib** memakai `ipv4_address: 172.30.0.10` dan meneruskan IP klien di `X-Forwarded-For`.
- Akses dev langsung ke `127.0.0.1:3001` tidak dipercaya sebagai proxy, sehingga rate limit memakai alamat gateway Docker.

## Tambahan Fase 1B: ember `internal`

Render dan revalidasi server Next.js datang dari kontainer web tanpa `X-Forwarded-For`, sehingga semuanya berbagi satu IP. Permintaan seperti itu (alamat socket ada di `TRUSTED_PROXY_IPS` **dan** tanpa `X-Forwarded-For`) kini memakai ember terpisah `internal` dengan `RATE_LIMIT_INTERNAL_PER_MINUTE` (default 1200). Permintaan yang meneruskan IP pengunjung tetap dibatasi per IP. Pemanggil di luar proxy tepercaya tidak pernah masuk ember ini, karena yang menentukan adalah alamat socket, bukan header (diuji di `rate-limit.int.test.ts`). Lihat ADR 0009.
