# Audit Fase 1D — Kinerja, Beban, dan Replika

- Tanggal: 17 November 2026
- Rencana: [`docs/plans/2026-11-13-fase-1d-kinerja-dan-beban.md`](../plans/2026-11-13-fase-1d-kinerja-dan-beban.md)
- Status: **Lulus gerbang mutu. Dua sasaran beban belum tercapai di laptop ini (§ 4); butuh keputusan pemilik (§ 8) sebelum Fase 2.**

## 1. Yang dihasilkan

| Area           | Hasil                                                                                                                                                        |
| -------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Cache bersama  | `cacheHandler` Next.js di Valkey: satu render dipakai kedua replika, revalidasi menjangkau keduanya, fail-open 200 ms, entri dibatasi per build (ADR 0010)   |
| Replika        | `web-1`/`web-2` di belakang Traefik (round-robin, health check, `retry`). API merevalidasi setiap replika. `mem_limit`/`pids_limit` untuk web dan API        |
| Tepi           | Kompresi per jenis respons: gzip untuk halaman (murah per kunjungan), brotli untuk aset statis (sekali per pengunjung)                                       |
| Uji beban      | `scripts/loadtest.mjs` + overlay CPU (tumpukan 3 vCPU, k6 1 vCPU), batas tepi asli per klien, pemanasan, catatan DB/API/Valkey (`docs/testing/uji-beban.md`) |
| Lighthouse     | `tests/perf` dengan gerbang `lighthouse` di `audit:all`                                                                                                      |
| Minor tertunda | Batas body revalidasi, env divalidasi di health check, komentar `ageDays`, daftar isi artikel, pesan pencarian kosong                                        |

## 2. Gerbang mutu

`pnpm audit:all` (17 Nov 2026): **17 gerbang** (baru: `lighthouse`), semuanya lulus pada kode final.

- Run pertama: 17/17 lulus.
- Run kedua (setelah perbaikan tinjauan): 16/17. Satu uji e2e gagal karena waktu tunggu klik pertama di tumpukan yang baru dibangun dan beban host tinggi (rebuild 290 s, biasanya 160 s).
- Spesifikasi itu lalu lulus 12/12 dengan cache dingin dan hangat, dan seluruh e2e diulang: **191/191**.

| Paket                      | Uji                                                                                                |
| -------------------------- | -------------------------------------------------------------------------------------------------- |
| web                        | 190 unit (+30: cache handler, health, revalidasi, filter, daftar isi, grafik) + 2 integrasi Valkey |
| api                        | 60 unit + 99 integrasi                                                                             |
| contracts, tokens, catalog | 20 + 33 + 7 unit                                                                                   |
| infra-check                | 30 pemeriksaan (+8: replika, HIT/revalidasi lintas replika, entri per build, tanpa zod di browser) |
| e2e                        | 191 skenario                                                                                       |
| ingest (Python)            | 54 uji, cakupan 97%                                                                                |

## 3. Lighthouse (profil seluler: 4G lambat, CPU 4×; median 3 run)

| Halaman                           | LCP      | CLS   | TBT    | JS       | Aksesibilitas |
| --------------------------------- | -------- | ----- | ------ | -------- | ------------- |
| `/`                               | 1.025 ms | 0     | 124 ms | 140,5 KB | 100           |
| `/beranda`                        | 1.229 ms | 0     | 96 ms  | 144,3 KB | 100           |
| `/harga`                          | 1.143 ms | 0,049 | 94 ms  | 143,9 KB | 100           |
| `/harga/cabai-merah-keriting`     | 1.118 ms | 0     | 90 ms  | 144,1 KB | 100           |
| `/prediksi`                       | 1.140 ms | 0,006 | 85 ms  | 143,2 KB | 100           |
| `/edukasi/apa-itu-inflasi-pangan` | 973 ms   | 0     | 128 ms | 140,5 KB | 100           |
| `/arif-net`                       | 1.118 ms | 0     | 166 ms | 140,5 KB | 100           |

Anggaran: LCP ≤ 2.500 ms, CLS < 0,1, TBT ≤ 200 ms, JS ≤ 170 KB, aksesibilitas 100. **Semua lulus.** TBT berasal dari hidrasi chunk framework, dan nilainya bergantung pada beban host (satu run saat Docker sibuk memberi 246–305 ms).

## 4. Uji beban (ringkasan; rincian di `docs/testing/uji-beban.md`)

| Uji                           | Hasil                                                                   | Sasaran                |
| ----------------------------- | ----------------------------------------------------------------------- | ---------------------- |
| 100 pengguna, bentuk 1C vs 1D | p95 477 ms → **329 ms**, 0% galat, 0 panggilan API                      | ✔                      |
| 150 / 200 pengguna            | 0% galat, p95 1.724 / 1.380 ms, ≤ 18 transaksi DB per ~10 rb permintaan | ✘ p95 (kapasitas ±120) |
| 500 pengguna × 5 menit        | Tidak selesai: Docker Desktop berhenti di tengah uji, tidak diulang     | ✘ belum terbukti       |
| Lonjakan 0 → 800              | 3,7% gagal saat antrean penuh; pulih sendiri (p95 sesudah 226 ms)       | ✘ tanpa 5xx / ✔ pulih  |
| Rate limit tepi               | 73% dijawab 429, klien lain 29/29 sukses                                | ✔                      |
| API langsung (0,4 vCPU)       | 0% galat, 256 req/detik, p95 1.375 ms, 28 transaksi DB                  | ✘ p95 < 100 ms         |
| DB tidak tersentuh pengunjung | Panggilan API 0–52 dan transaksi DB ≤ 21 per uji halaman                | ✔                      |

Hal-hal yang terbukti:

- Desain cache bekerja: database dan API praktis tidak tersentuh oleh pengunjung.
- Tidak ada galat sampai 200 pengguna.
- Satu replika boleh mati tanpa galat.

Batasnya adalah **CPU per permintaan halaman**:

- ±20 ms CPU per hit halaman 220 KB di Next.js.
- Kompresi di tepi.

Dengan 3 vCPU untuk seluruh tumpukan, kapasitas ±120 pengguna aktif pada p95 < 500 ms.

## 5. Temuan selama pelaksanaan (diperbaiki)

1. **Build baru menyajikan halaman build lama** (cache bersama bertahan saat deploy). Entri kini dibatasi `BUILD_ID`, diuji unit dan `infra-check`.
2. **Zod ikut ke browser di setiap halaman data** (±30 KB). Penyebabnya impor indeks `@kawan-pasar/contracts` dari komponen klien. Diperbaiki dengan subpath `@kawan-pasar/contracts/staleness`, dan `infra-check` menjaga agar tidak terulang.
3. **Brotli di tepi memakan ~50 ms CPU per halaman** (8,8 vs 24,9 req/detik dibanding gzip). Kompresi kini dipilih per router.
4. **Tooltip grafik mengirim koordinat presisi penuh.** Dibulatkan 0,1%; `/harga` turun dari 242 KB menjadi 222 KB.
5. **Urutan judul** (`heading-order`) di Beranda dan grafik riwayat.
6. **Route revalidasi membaca body tanpa batas.** Pekerja uji sampai kehabisan memori.
7. **Infrastruktur uji:**
   - pembagian CPU pertama membuat PostgreSQL kekurangan CPU untuk render pertama;
   - pembuat konfigurasi Traefik uji gagal pada berkas CRLF;
   - Docker Desktop berhenti dua kali.

## 6. Tinjauan independen

Tinjauan oleh model paling mampu, baca-saja. Fokusnya lima butir dari rencana: konsistensi antarreplika, Valkey mati atau lambat, serialisasi, replika mati, dan kejujuran uji beban.

- **Critical: tidak ada.**
- **Important (diperbaiki):**
  1. **Revalidasi dari API hanya ke `web-1`.** Bila `web-1` mati, atau tulis Valkey di `web-1` gagal, `web-2` menyajikan data lama sampai revalidasi cadangan: 6 jam untuk edukasi, 24 jam untuk pasar. Sekarang `WEB_INTERNAL_URL` berisi daftar dan setiap replika direvalidasi. Uji RED → GREEN. ADR 0010 diperbaiki.
  2. **Pembacaan tag bisa menimpa revalidasi lokal yang lebih baru.** Status lokal dan Valkey kini digabung dengan stempel waktu terbaru. Uji RED → GREEN.
  3. **`uji-beban.md` tidak menandai ambang "tanpa 5xx" uji lonjakan sebagai gagal.** Sudah diperbaiki.
  4. **Baseline "1C" tidak persis 1C** (memakai penyimpanan baru dengan serialisasi). Kini dijelaskan apa adanya.
- **Minor (ditunda):**
  - Valkey yang lambat (bukan mati) bisa menambah beberapa kali 200 ms per render; belum ada pemutus sirkuit.
  - Render yang berlangsung melewati saat revalidasi tersimpan sebagai segar. Race ini sama dengan cache bawaan Next.
  - `allkeys-lru` bisa mengusir catatan tag (256 MB dibagi dengan API).
  - Ringkasan uji beban tidak ditulis bila satu skenario melempar galat.
- Minor yang murah langsung diperbaiki: pemanasan uji beban menandai halaman non-200, dan angka CPU yang usang di dokumen.

## 7. Keputusan pelaksanaan (rulings)

Daftar lengkap ada di buku catatan pelaksanaan. Ringkasnya:

- **Kesegaran dan cadangan cache:**
  - Kesegaran memakai `tagsManifest` milik Next (disinkronkan dari Valkey), bukan perhitungan sendiri.
  - Tanpa Valkey dipakai penyimpanan memori, bukan cache berkas internal Next.
- **Bentuk uji beban:**
  - Batas tepi tetap nilai asli tetapi dihitung per pengguna virtual.
  - Uji kapasitas dimulai setelah pemanasan.
  - Pembagian CPU mengikuti profil terukur.
- **Minor 1B #3 tidak diperbaiki** (respons yang melanggar kontrak tersimpan di cache data):
  - Next melarang revalidasi saat render, dan refetch `no-store` membuat rute ISR menjadi dinamis.
  - Kasus ini hanya terjadi bila API dan web tidak dirilis bersamaan.
  - Dampaknya dibatasi revalidasi tag atau 600 s.
- Kompresi halaman memakai gzip: sedikit lebih besar di jaringan (41 KB vs 28,5 KB untuk `/harga`), tetapi tiga kali lebih murah di CPU.

## 8. Catatan untuk pemilik

1. **Keputusan dibutuhkan: sasaran 500 pengguna.** Di laptop ini sasaran itu tidak tercapai karena batas CPU, bukan karena desain. Opsi:
   - (a) Menerima angka laptop sebagai batas bawah dan menguji ulang di server.
   - (b) Menambah cache HTML di tepi (mis. cache mikro di depan web atau CDN di produksi), sehingga hit halaman tidak lagi melewati Next.
   - (c) Mengurangi bobot halaman lebih jauh (payload RSC ±60% dari HTML).
2. **Sasaran API p95 < 100 ms** juga dibatasi CPU (0,4 vCPU dalam uji ini). Pengunjung tidak memanggil API secara langsung.
3. Masih terbuka dari fase sebelumnya: 5 draf artikel menunggu tinjauan, dan `PUBLIC_SITE_URL` untuk produksi.
