# Audit Fase 1C — Halaman Publik

- Tanggal: 13 November 2026
- Rencana: [`docs/plans/2026-11-12-fase-1c-halaman-publik.md`](../plans/2026-11-12-fase-1c-halaman-publik.md)
- Status: **Lulus. Menunggu tinjauan dan commit pemilik sebelum Fase 1D.**

## 1. Yang dihasilkan

| Area          | Hasil                                                                                                                                                                            |
| ------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Halaman       | Beranda Publik, Beranda, Harga, Detail komoditas, Prediksi (8 horizon), Edukasi, Artikel, ARIF-Net, Keterbatasan, Pilih Pasar, Lainnya; semuanya dengan data nyata dan responsif |
| Grafik        | SVG server tanpa library: riwayat 4 rentang, prediksi (aktual, median, rentang 80%, hari dasar); ringkasan teks dan tabel sebagai alternatif; tooltip dengan papan ketik         |
| Aturan produk | Fungsi murni yang diuji: angka prediksi hanya untuk `available`/`expired`, label "Kedaluwarsa"/"Data demo", `null` → "—", Kata Kapa berbasis fakta                               |
| API           | `forecastArtifact` di ringkasan (tanpa query tambahan); aturan "terlambat" dibagi lewat `@kawan-pasar/contracts`                                                                 |
| Konten        | Artikel Markdown via `react-markdown` di server (tanpa HTML mentah); angka akurasi ARIF-Net dari Tabel 4.5 laporan v04 (dikunci uji)                                             |
| Keamanan      | Penjaga path untuk URL publik dan internal (404 `no-store` tanpa render); cookie orientasi fungsional; URL kanonik; sitemap tanpa API                                            |
| Uji           | e2e: perjalanan pengguna, aturan produk, tanpa JS, 14 halaman × 6 lebar, teks 200%, reflow 320 px, axe                                                                           |

## 2. Gerbang mutu

`pnpm audit:all` run final (13 Nov 2026): **16/16 gerbang lulus**: format, lint, typecheck, unit, build web tanpa API, rebuild kontainer, infra (22 pemeriksaan), integrasi API, e2e (191), reset DB uji, ingest pytest (cakupan 96,9%), mypy strict, ruff, audit dependensi (0 kerentanan), pemindaian `any`, dan pemindaian atribusi AI.

| Paket           | Uji                                                          |
| --------------- | ------------------------------------------------------------ |
| web             | 160 unit (halaman, komponen, grafik, logika tampilan, proxy) |
| contracts       | 20 unit                                                      |
| tokens, catalog | 33 + 7 unit                                                  |
| api             | 59 unit + 99 integrasi                                       |
| e2e             | 191 skenario (Chromium, lewat Traefik)                       |
| ingest (Python) | 54 uji, cakupan ±97%                                         |

## 3. Simulasi pengguna akhir

| Pemeriksaan                                  | Hasil                                                                                                                                                                 |
| -------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Perjalanan pengguna (360, 1280 px)           | Orientasi → Beranda (kunjungan berikutnya langsung ke Beranda); Beranda → Detail → Prediksi → ganti horizon dan komoditas; Edukasi → Artikel; ARIF-Net → Keterbatasan |
| Aturan produk (semua halaman)                | Tidak ada "Rp 0"; rawit "—" + "Prediksi menyusul"; versi model + "Data demo" + disclaimer di setiap halaman berangka prediksi; data terlambat diumumkan               |
| Tanpa JavaScript                             | 14 halaman tampil; grafik 90 hari dan horizon 7 hari; semua komoditas; tanpa kontrol mati                                                                             |
| Lebar 320–1440 px, teks 200%                 | Tanpa scroll horizontal; tabel lebar berada di region gulir yang bisa difokus                                                                                         |
| axe WCAG 2.2 AA (360 dan 1280 px)            | 0 pelanggaran di 14 halaman                                                                                                                                           |
| JS awal                                      | ≤ 170 KB terkompresi di semua rute (Beranda ±167 KB: ruang tersisa tipis, dipantau di 1D)                                                                             |
| Pemeriksaan visual (Beranda, Prediksi, 1280) | Sesuai tata letak v0.4 dengan data nyata                                                                                                                              |

## 4. Temuan selama pelaksanaan (diperbaiki)

| #   | Tingkat     | Temuan                                                                                                                                                                              | Perbaikan                                                                                |
| --- | ----------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------- |
| 1   | **Penting** | Uji integrasi API berbagi Valkey database 0 dengan API dev. Bundel prediksi **uji** (non-demo) dari ringkasan yang di-cache tersaji di dev tanpa label "Data demo" (bawaan Fase 1A) | Uji memakai database 15 (`test/helpers/load-env.ts`, uji isolasi); cache dev dibersihkan |
| 2   | Penting     | Health check Traefik (timeout 3 s) menandai satu-satunya replika web mati saat CPU jenuh, sehingga semua aset dibalas 503                                                           | Timeout 8 s; keputusan replika di Fase 1D                                                |
| 3   | Sedang      | Grid tanpa template kolom tidak bisa menyusut (luapan di 320 px dan teks 200%)                                                                                                      | `.grid` default `minmax(0,1fr)`                                                          |
| 4   | Sedang      | Teks `sr-only` (absolut) di kontainer gulir melebarkan dokumen                                                                                                                      | Kontainer `overflow-*` menjadi containing block                                          |
| 5   | Sedang      | Kontras (angka langkah kunyit, teks `opacity`) dan region gulir yang tidak bisa difokus (axe)                                                                                       | Warna token AA, `tabIndex` + `role="region"`                                             |
| 6   | Rendah      | Uji anggaran JS ikut menghitung chunk yang di-prefetch Next untuk tautan                                                                                                            | Hanya skrip yang dimuat halaman (`initiatorType === 'script'`)                           |
| 7   | Rendah      | Skrip audit crash pada berkas terlacak yang sudah dihapus (`staleness.ts` dipindah)                                                                                                 | Daftar berkas disaring dengan `existsSync`                                               |

## 5. Tinjauan independen

Hasil: **1 kritis, 7 penting**, ditambah minor. Yang kritis dan penting diperbaiki dengan uji RED → GREEN, ditambah 4 minor murah.

| Temuan                                                                                                                                                                                                                | Perbaikan                                                                                                 |
| --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------- |
| **Kritis:** penjaga path di `proxy.ts` tidak pernah berjalan untuk URL publik (proxy melihat URL sebelum rewrite). `/harga/<acak>` dirender dan 404-nya di-cache ISR. Uji sinkronisasi hanya memeriksa tujuan rewrite | `matcher` + logika untuk `/<section>/…`; uji memeriksa sumber rewrite; e2e mewajibkan `no-store` pada 404 |
| `overflow-wrap: anywhere` mematahkan nama di tengah kata di tabel harga (tablet)                                                                                                                                      | `break-word` global; `break-all` hanya untuk versi model/data                                             |
| Prediksi kedaluwarsa tanpa label di kartu sorotan dan metadata Beranda/Harga                                                                                                                                          | Label "Kedaluwarsa" di kartu dan `PredictionMeta`                                                         |
| `/harga` hanya membawa metadata ringkas (tanpa versi data dan batas data)                                                                                                                                             | Metadata lengkap                                                                                          |
| Detail/teaser menyebut prediksi tersembunyi atau tidak tersedia sebagai "menyusul tahap berikutnya"                                                                                                                   | `noForecastKind()`: hanya `pending_coverage` yang "menyusul"                                              |
| Tooltip grafik menjadi kontrol mati tanpa JS, nilai pembaca layar tanpa arti                                                                                                                                          | Dirender setelah hidrasi, mulai dari titik terakhir, selalu `aria-valuetext`, Home/End                    |
| Grafik prediksi tanpa alternatif teks di Beranda dan Detail                                                                                                                                                           | Ringkasan per horizon + tabel semua horizon di `ForecastChart`                                            |
| `PUBLIC_SITE_URL` tidak pernah diset                                                                                                                                                                                  | Build arg + env di compose dan Dockerfile, kunci di `.env.example`                                        |
| _(minor)_ Pemberitahuan basi tidak ada tanpa JS                                                                                                                                                                       | Status basi dari server menjadi snapshot server                                                           |
| _(minor)_ Badge prediksi di Detail tanpa "Data demo"                                                                                                                                                                  | `isDemo` diteruskan                                                                                       |
| _(minor)_ Tick tanggal ganda untuk rentang pendek                                                                                                                                                                     | Deduplikasi                                                                                               |
| _(minor)_ Kata "karena" di konten ARIF-Net                                                                                                                                                                            | Kalimat diubah                                                                                            |

**Minor yang ditunda:**

1. `ageDays` di ringkasan bisa terlambat 1 hari sampai 1 jam (TTL ringkasan tidak selaras dengan batas 24 jam umur bundel). Komentar kode diperbaiki di fase berikutnya.
2. Daftar isi artikel:
   - judul berisi tautan menghasilkan id yang berbeda dari daftar isi;
   - judul ganda menghasilkan id ganda;
   - `##` di dalam blok kode ikut masuk daftar isi.
3. Uji e2e bergantung pada lingkungan: data seed yang sudah lama dan bundel demo aktif. Belum ada skenario e2e dengan bundel kedaluwarsa atau tersembunyi (sudah diuji di tingkat halaman). `isolation.test.ts` membaca `.env` langsung.
4. Ruang anggaran JS di Beranda tipis (±167 dari 170 KB).
5. `/` disajikan dengan `s-maxage` tanpa `Vary: Cookie`. Aman tanpa CDN; perlu ditangani sebelum CDN dipasang.
6. Pencarian komoditas tanpa hasil tidak menampilkan pesan "tidak ditemukan".
7. Kata Kapa "Pantau perubahannya… sebelum menyusun anggaran" bisa dibaca sebagai saran halus. Pertimbangkan kalimat yang murni faktual saat meninjau draf artikel.

## 6. Keputusan pelaksanaan (rulings)

| Ruling                                                                                    | Alasan                                                                          | Biaya bila salah                                                                |
| ----------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------- | ------------------------------------------------------------------------------- |
| Pemilih komoditas Prediksi berupa tautan berbentuk pil (bukan `<select>` v0.4)            | Berfungsi tanpa JS, tanpa pulau klien tambahan                                  | Berbeda visual dari prototipe                                                   |
| Varian grafik dan horizon dirender server lalu dipilih lewat atribut `data-*`             | Tanpa fetch di browser, tanpa library grafik, tetap berfungsi tanpa JS          | HTML lebih besar (dikompresi brotli)                                            |
| Halaman data selalu melempar galat bila salah satu fetch gagal                            | Cache ISR tidak pernah menyimpan halaman setengah jadi                          | Satu sumber gagal membuat halaman memakai versi cache terakhir / "Gagal memuat" |
| Skenario e2e bundel kedaluwarsa/tersembunyi diuji di tingkat halaman (fixture), bukan e2e | e2e berjalan terhadap data dev; mengubah umur bundel akan mengubah data pemilik | Jalur render penuh status tersebut belum diuji di browser                       |
| Toleransi 1 px pada pemeriksaan teks 200%                                                 | Pembulatan subpiksel `scrollWidth`; pemeriksaan per elemen dan teks tetap ketat | Luapan 1 px yang nyata bisa lolos                                               |
| Health check Traefik 8 s                                                                  | Satu replika: kelambatan tidak boleh menjadi pemadaman                          | Replika yang benar-benar hang dikeluarkan lebih lambat                          |

## 7. Catatan untuk pemilik

1. **5 draf artikel** masih menunggu tinjauan Anda. Edukasi saat ini hanya menampilkan 1 artikel terbit dan "Topik lain segera hadir".
2. Untuk domain produksi, set `PUBLIC_SITE_URL` di `.env` (dipakai untuk URL kanonik dan sitemap; halaman statis memakainya saat build).
3. Docker Desktop sempat berhenti dua kali selama fase ini, lalu dinyalakan ulang. Bila `:8080` tidak merespons, cek Docker Desktop terlebih dulu.
4. Semua perubahan belum di-commit; usulan urutan commit diberikan terpisah.
