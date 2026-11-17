# Uji Beban (k6)

Skrip ada di `tests/load/`, dijalankan oleh `scripts/loadtest.mjs`. Jalur yang diuji sama dengan produksi: k6 → Traefik → web (2 replika, cache bersama) → API → PostgreSQL.

## Menjalankan

```bash
node scripts/loadtest.mjs browse spike edge api        # skenario berurutan
node scripts/loadtest.mjs browse --vus 100 --hold 60s  # uji pendek
node scripts/loadtest.mjs browse --vus 100 --hold 60s --baseline   # bentuk Fase 1C
```

Untuk setiap skenario, skrip:

1. Menyalakan overlay `infra/compose/docker-compose.loadtest.yml` dengan CPU dibatasi.
2. Membuat konfigurasi Traefik uji dari berkas asli (`.audit/loadtest-traefik/`).
3. Mengosongkan cache (Valkey database 0 dan 1), lalu memanaskan setiap halaman sekali. Waktu render pertama ikut dilaporkan.
4. Mencatat transaksi PostgreSQL, permintaan API (log API), dan hit Valkey sebelum dan sesudah uji.
5. Menjalankan k6 (`grafana/k6:2.3.0`, `--cpus 1`) dari 172.30.0.12 di jaringan backend.
6. Menulis `.audit/loadtest/summary-*.json` beserta ringkasan k6 mentah.
7. Mengembalikan tumpukan normal (`--keep` untuk membiarkan overlay tetap jalan).

### Pembagian CPU (laptop 4 vCPU)

| Layanan            | vCPU    | Layanan   | vCPU    |
| ------------------ | ------- | --------- | ------- |
| web-1 / web-2      | 0,75    | api       | 0,40    |
| traefik            | 0,55    | postgres  | 0,30    |
| valkey-cache       | 0,20    | pgbouncer | 0,05    |
| **Total tumpukan** | **3,0** | **k6**    | **1,0** |

Pembagian ini mengikuti profil yang terukur:

- Halaman dari cache tidak menyentuh API dan database. Pada uji pertama, API ~8% CPU dan PostgreSQL ~3%.
- Web dan kompresi di tepi yang jenuh.
- PostgreSQL tetap mendapat cukup jatah untuk render pertama. Dengan 0,2 vCPU, query render pertama sempat butuh 1,6 detik dan berbuah 500.

Mode `--baseline` mendekati bentuk Fase 1C: satu replika, CPU 1,5 vCPU (jatah kedua replika), cache di proses. Bedanya dengan Fase 1C yang sebenarnya:

- Cache di prosesnya adalah penyimpanan memori milik handler baru, yang menyerialisasi entri seperti versi Valkey. Cache bawaan Next menyimpan objek langsung.
- Satu proses Node tidak bisa memakai 1,5 vCPU untuk render seefektif dua proses 0,75 vCPU.

Perbandingan di bawah adalah bentuk arsitektur dengan biaya serialisasi yang sama, bukan reproduksi persis Fase 1C.

### Batas tepi per klien

Batas Traefik (50/detik, burst 100, 100 permintaan bersamaan) **tetap nilai asli**. Di overlay, Traefik hanya memercayai `X-Forwarded-For` dari kontainer k6, sehingga setiap pengguna virtual dihitung sebagai klien sendiri, seperti pengunjung sungguhan. Skenario `edge` memakai konfigurasi Traefik asli tanpa perubahan.

| Skrip                | Isi                                                                                                                                                                      | Ambang                                           |
| -------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------ |
| `web-browse.js`      | Naik 30 detik, tahan N pengguna (bawaan 500 × 5 menit). Beranda → Harga → detail → Prediksi → detail → Edukasi → artikel, jeda 1–3 detik, JS diunduh sekali per pengguna | galat < 0,5%, p95 halaman < 500 ms, checks > 99% |
| `web-spike.js`       | 0 → 800 pengguna dalam 10 detik, tahan 60 detik, lalu 30 pengguna selama 30 detik                                                                                        | tanpa 5xx; p95 fase sesudah < 500 ms             |
| `edge-rate-limit.js` | 1 klien 200 req/detik selama 10 detik; klien lain (host) meminta setiap 250 ms                                                                                           | > 1.000 × 429, tidak ada status lain             |
| `api-public.js`      | 200 pengguna × 60 detik langsung ke API (Fase 1A)                                                                                                                        | p95 < 100 ms, 0% galat                           |

## Hasil Fase 1D (17 Nov 2026, laptop dev, pembagian CPU di atas)

**Angka ini batas bawah untuk mesin kecil (3 vCPU untuk seluruh tumpukan), bukan angka produksi.** Halaman sudah dipanaskan, kecuali pada data render pertama.

### Perbandingan arsitektur (100 pengguna, 60 detik, CPU sama)

| Bentuk                                | Permintaan | Galat | p95 halaman | Panggilan API selama uji | Transaksi DB |
| ------------------------------------- | ---------- | ----- | ----------- | ------------------------ | ------------ |
| Bentuk 1C: 1 replika, cache di proses | 5.361      | 0%    | 477 ms      | 0                        | 21           |
| **Fase 1D: 2 replika, cache Valkey**  | 5.434      | 0%    | **329 ms**  | 0                        | 10           |

### Kapasitas halaman

| Pengguna | Permintaan/detik | Galat | p95 halaman | Panggilan API | Transaksi DB |
| -------- | ---------------- | ----- | ----------- | ------------- | ------------ |
| 100      | 47               | 0%    | 329 ms ✔    | 0             | 10           |
| 150      | 68               | 0%    | 1.724 ms    | 52            | 12           |
| 200      | 90               | 0%    | 1.380 ms    | 16            | 18           |
| 500      | —                | —     | —           | —             | —            |

- **Tidak ada galat sampai 200 pengguna**, dan database praktis tidak tersentuh oleh pengunjung (≤ 18 transaksi per ~10 ribu permintaan, termasuk health check). Setelah ±120 pengguna, permintaan mengantre di CPU web dan p95 naik di atas 500 ms.
- **500 pengguna tidak dijalankan sampai selesai.** Percobaan pertama membuat Docker Desktop di laptop ini berhenti (`unexpected EOF`), sehingga tidak diulang. Perilaku di atas kapasitas terlihat dari uji lonjakan.
- **Penyebab batasnya terukur:**
  - Uji A/B pada 0,5 vCPU per replika: `/harga` (220 KB) 24,5 hit/detik dengan penyimpanan memori handler, 17,3 hit/detik dengan Valkey. Jadi ±20 ms CPU per hit, termasuk dekode entri, dan Valkey menambah ~30%.
  - Kompresi brotli di tepi memakan ~50 ms per halaman; gzip ~2 ms. Karena itu halaman memakai gzip dan aset statis brotli (ADR 0010).
- Render pertama (cache dingin, 0,3 vCPU PostgreSQL): 100–1.600 ms per halaman.

### Lonjakan, rate limit, API

| Uji                       | Hasil                                                                                                                                                 |
| ------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------- |
| Lonjakan 0 → 800 pengguna | 8.411 permintaan, 3,7% gagal (5xx/terputus saat antrean penuh), 0 × 429. ✘ Ambang "tanpa 5xx" **gagal**. **Pulih sendiri:** p95 fase sesudah 226 ms ✔ |
| Rate limit tepi (asli)    | 1.940 permintaan: 73% dijawab 429 oleh Traefik; klien lain 29/29 sukses ✔                                                                             |
| API langsung (0,4 vCPU)   | 15.909 permintaan, 256/detik, 0% galat, median 496 ms, p95 1.375 ms (Fase 1A, seluruh laptop: 378 ms). 28 transaksi DB                                |

**Sasaran yang belum tercapai di laptop ini:**

- 500 pengguna dengan p95 < 500 ms. Kapasitas terukur ±120 pengguna per 3 vCPU.
- Lonjakan 800 pengguna tanpa 5xx. 3,7% permintaan gagal saat antrean penuh, lalu pulih sendiri.
- API p95 < 100 ms.

Ketiganya dibatasi CPU, bukan database atau desain cache. Opsinya dicatat di audit Fase 1D (§ Keputusan pemilik).

## Hasil Fase 1A (12 Nov 2026, laptop dev, tanpa pembagian CPU)

| Kondisi                                       | Permintaan | Galat  | Median | p95        | Transaksi DB          |
| --------------------------------------------- | ---------- | ------ | ------ | ---------- | --------------------- |
| Sebelum optimasi                              | 5.853      | 0,10%  | —      | 9,75 s     | 52                    |
| Setelah cache JSON-text (ADR 0007), 1 replika | 20.082     | **0%** | 47 ms  | **378 ms** | **34**                |
| Rate limit                                    | 150        | —      | —      | —          | 120 × 200, 30 × 429 ✔ |
