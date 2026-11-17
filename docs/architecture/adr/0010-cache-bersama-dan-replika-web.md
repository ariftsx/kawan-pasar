# ADR 0010 — Cache halaman bersama di Valkey dan dua replika web

- Status: **Diterima** (13 Nov 2026, Fase 1D; keputusan pemilik "Cache bersama di Valkey")
- Terkait: desain §6.1, §11; ADR 0003, 0005, 0009

## Konteks

1. Fase 1D menjalankan dua replika web di belakang Traefik.
2. Cache ISR bawaan Next.js adalah berkas per proses. Dengan dua replika, setiap replika merender dan menyimpan halamannya sendiri. Akibatnya:
   - API dan database tersentuh dua kali per pembaruan.
   - Revalidasi dari API (satu panggilan ke satu replika) hanya menyegarkan replika itu.
3. Next.js 16 menyediakan `cacheHandler`: satu kelas yang menggantikan penyimpanan ISR dan cache data `fetch`. `cacheHandlers` (jamak) hanya untuk `'use cache'`, yang tidak dipakai di sini.

## Keputusan

### Penyimpanan

- `apps/web/src/cache/` berisi:
  - `handler.ts`: logika;
  - `store.ts`: Valkey, atau memori tanpa URL;
  - `serialize.ts`: JSON yang menjaga `Buffer` dan `Map`;
  - `valkey-cache-handler.ts`: titik masuk.
- Next.js memuat handler apa adanya saat runtime (tanpa bundling). Karena itu handler dikompilasi dengan `tsc` ke `apps/web/dist/cache-handler/` sebelum `next build` (`pnpm build:cache-handler`, termasuk di `dev` dan `build`).
- `next.config.ts`: `cacheHandler` ke berkas itu dan `cacheMaxMemorySize: 0`. Tidak ada salinan per proses, sehingga replika lain melihat revalidasi pada pembacaan berikutnya.
- Basis data 1 dari `valkey-cache` (`VALKEY_WEB_CACHE_URL`). API memakai 0, uji integrasi web 14, uji integrasi API 15.
- **Kunci:**
  - Entri: `kp:web:v1:entry:<BUILD_ID>:<kunci Next>`.
  - Tag: `kp:web:v1:tag:<tag>`.
- **Masa simpan:**
  - Entri: `expire` dari Next, paling lama 7 hari.
  - Tag: 8 hari.
  - `allkeys-lru` (256 MB) menjadi pengaman memori.

### Entri dibatasi per build

Halaman dari build lama merujuk chunk JS yang tidak ada lagi di build baru. Tanpa pembatasan ini, setelah deploy pengunjung akan menerima halaman lama dengan skrip 404 (ditemukan saat uji Fase 1D). `BUILD_ID` dibaca dari `serverDistDir` yang diberikan Next ke handler. Status tag **tetap dibagi** antarbuild, karena revalidasi data berlaku untuk semuanya.

### Kesegaran mengikuti aturan Next sendiri

- `revalidateTag(tag, 'max')` menulis `{stale, expired}` ke Valkey, dengan transisi yang sama seperti cache berkas bawaan Next.
- Setiap `get` membaca status semua tag entri dalam **satu** `MGET`:
  - tag `fetch` dan tag implisit halaman, atau
  - header `x-next-cache-tags` untuk halaman.
- Status tag lalu disalin ke `tagsManifest` milik Next di proses itu. Next sendiri yang memutuskan _stale-while-revalidate_ atau render memblok, persis seperti cache bawaan.
- Entri yang tag-nya kedaluwarsa dikembalikan sebagai _miss_.

### Fail-open

- Setiap operasi dibatasi **200 ms**.
- ioredis berjalan tanpa antrean offline dan tanpa retry, sehingga gagal cepat saat Valkey tidak terjangkau.
- Bila galat atau timeout:
  - `get` → `null` (render langsung);
  - `set` dan `revalidateTag` dilewati.
- Peringatan maksimal 1 baris per 10 detik, dengan jumlah yang ditekan, dan tanpa nilai. Valkey mati tidak menyebabkan 500.
- Bila status tag tidak terbaca, entri dianggap _miss_: lebih aman merender daripada menyajikan halaman yang mungkin sudah direvalidasi.

### Replika dan tepi

- `web-1` 172.30.0.10 dan `web-2` 172.30.0.11 memakai image dan anchor compose yang sama.
  - `mem_limit` 512m, `pids_limit` 256.
  - tmpfs kecil, karena halaman tidak lagi disimpan di disk.
  - Tanpa `depends_on`: halaman statis tidak butuh API, dan cache yang mati hanya berarti render tanpa cache.
- API: `TRUSTED_PROXY_IPS=172.30.0.10,172.30.0.11`. `WEB_INTERNAL_URL=http://web-1:3000,http://web-2:3000`. Satu revalidasi yang diterima sudah cukup karena cache dibagi. API tetap memanggil setiap replika secara terpisah, sehingga replika yang mati atau tulis Valkey yang gagal di satu replika tidak menghilangkan revalidasi (tinjauan Fase 1D).
- **Traefik:**
  - Round-robin ke dua server dengan health check (timeout 8 s).
  - `retry` (2 percobaan, hanya galat koneksi), sehingga permintaan ke replika yang baru mati diulang ke replika lain.
- **Kompresi per jenis respons:**
  - Halaman: `compress-html` dengan gzip lebih dulu. Brotli Go memakan ~50 ms CPU per halaman 200 KB pada 0,25 vCPU; gzip ~2 ms.
  - `/_next/static/`: `compress-static` dengan brotli lebih dulu. Aset ini immutable dan diunduh sekali per pengunjung.
  - Klien yang meminta `br` lebih dulu tetap mendapat brotli.

## Akibat

- Satu render per halaman untuk kedua replika (diuji `infra-check`). Revalidasi yang diterima `web-1` membuat `web-2` menyajikan `STALE` lalu versi baru.
- Bila **semua** replika tidak terjangkau, revalidasi dari API gagal dan dicatat. Halaman lalu baru disegarkan oleh revalidasi cadangan per halaman: 600 detik untuk harga dan prediksi, 21.600 detik untuk edukasi, 86.400 detik untuk pasar.
- Pembacaan tag menggabungkan status lokal dan Valkey dengan stempel waktu yang lebih baru. Revalidasi yang baru dibuat replika ini tidak tertimpa status lama dari Valkey.
- Bergantung pada modul internal Next `tags-manifest.external.js`. Versi Next dipatok (16.4.6), dan uji integrasi + `infra-check` akan gagal bila kontraknya berubah.
- Cache hit halaman besar sedikit lebih mahal daripada cache memori (~30% pada halaman 220 KB, terutama base64 dan transfer). Kandidat optimasi: format biner untuk payload RSC.
- Deploy baru dimulai dengan cache halaman dingin (per build). Cache data tag tetap konsisten.
