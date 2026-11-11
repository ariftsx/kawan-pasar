# Desain Sistem Kawan Pasar — Platform Web (v0.4 → implementasi)

- Tanggal: 11 November 2026
- Status: **Disetujui pemilik produk (11 Nov 2026)**. Fase 0–4 dikerjakan sambil menunggu model ARIF-Net selesai.
- Acuan: `Laporan_CP_Kawan_Pasar_v04.pdf` (laporan), `figcraft-Kawan_Pasar/` (prototipe v0.4), `data/seed/prices_combined.csv` (dataset)

Penanda keputusan di dokumen ini:
- **[Pemilik]**: diputuskan pemilik produk dalam diskusi 11 Nov 2026.
- **[Laporan]**: sudah ditetapkan laporan v04 dan dipertahankan.
- **[Usulan]**: keputusan perancang yang masih boleh diganti pemilik.

---

## 1. Maksud dan alasan

Kawan Pasar adalah platform web publik untuk memantau dan memprediksi harga komoditas pangan, dimulai dari Pasar Kramat Jati. Pengguna utamanya konsumen rumah tangga dan UMKM, yang mengakses tanpa mendaftar dan kebanyakan lewat ponsel dengan jaringan 4G. Pengguna lainnya Pengguna Terdaftar (peringatan), Analis (TPID/peneliti), dan Administrator.

Prototipe v0.4 sudah dinyatakan siap diimplementasikan ulang, dan seluruh basis kode dibangun **dari nol** [Pemilik]. Pemilik menekankan bahwa yang dicari **bukan tampilan bagus, tetapi performa, keamanan, dan ketahanan saat melayani banyak pengguna**. Tampilan mengikuti sistem desain v0.4 yang diperhalus seperlunya.

## 2. Tujuan, non-tujuan, anti-tujuan

**Tujuan**
1. Semua halaman publik v0.4 berjalan dengan data nyata dari dataset tim, responsif dari lebar 360 px sampai desktop 1280+.
2. Sistem tahan beban: halaman publik tetap cepat saat diakses banyak pengguna serentak, dan database tidak menjadi titik jenuh.
3. Keamanan berlapis sejak fondasi, tidak ditambal belakangan (lihat §9).
4. Kode bersih: TypeScript strict tanpa `any`, atomic design di frontend, modul domain yang jelas di backend.
5. Dokumentasi lengkap di `docs/` sebagai knowledge base proyek.
6. Setiap fase ditutup dengan audit dan simulasi pengguna akhir sebelum lanjut ke fase berikutnya.

**Non-tujuan (di luar lingkup sekarang)**
- Mengembangkan model ARIF-Net. `services/model-arifnet/` hanya berisi struktur direktori, README kontrak, dan placeholder [Pemilik].
- Apache Airflow, IndoBERT, dan pipeline sentimen (milik anggota tim lain).
- Penerapan produksi (Docker Swarm, Cloudflare Tunnel, domain). Semuanya **lokal** dulu [Pemilik], tetapi konfigurasi dibuat agar mudah dipindah ke produksi.
- Integrasi WhatsApp Business API sungguhan (fase akun; di lokal memakai adapter tiruan).
- Evaluasi SUS (Tugas Akhir).

**Anti-tujuan (dianggap gagal walaupun "jalan")**
- Prediksi tampil tanpa versi model, versi data, dan batas data. Nilai tidak diketahui tampil sebagai 0.
- Bahasa kausal ("harga naik karena…") atau rekomendasi beli/jual.
- Halaman publik memicu query DB per pengunjung, atau N+1 query.
- Ada `any`, `@ts-ignore`, atau validasi hanya di satu sisi.
- Animasi maskot membuat halaman berat atau mengabaikan `prefers-reduced-motion`.
- Kontribusi AI tercatat di repo, atau git dijalankan tanpa pemilik (lihat §3).

## 3. Batasan

1. **Tidak ada atribusi AI/asisten di repo**: tidak di commit, komentar, dokumen, maupun changelog. **Seluruh operasi git dijalankan pemilik sendiri** setelah ditinjau; perancang paling jauh menyarankan pesan commit [Pemilik]. Aturan ini juga dicatat di `CONTRIBUTING.md`.
2. Lingkungan lokal Windows 11 + Docker Desktop 29. Node 24 LTS, pnpm 11, Python 3.14, uv 0.13.
3. Versi package: terbaru yang **stabil dan saling kompatibel** (matriks di §15). Kompatibilitas menang atas "paling baru".
4. Aturan produk dari laporan [Laporan], diuji otomatis:
   - Prediksi hanya tampil bila metadata versi lengkap. Artefak >8 hari diberi label kedaluwarsa, >28 hari disembunyikan.
   - Tidak diketahui = `NULL` di DB dan "—" di UI, tidak pernah 0.
   - Harga **terlambat** bila observasi terakhir lebih dari 2 hari kerja sebelum hari ini (zona Asia/Jakarta).
   - Kunci unik observasi: (komoditas, pasar, tanggal).
   - Setiap halaman prediksi memuat pernyataan "prediksi bukan jaminan harga".
5. NFR [Laporan]: LCP p75 ≤ 2,5 detik di 4G; JS awal ≤ 170 KB terkompresi per rute; WCAG 2.2 AA (informasi tidak bergantung pada warna); layanan model internal-only dengan HMAC-SHA256 dan toleransi waktu 60 detik; minimisasi data dan hak hapus sesuai UU PDP No. 27/2022.

## 4. Keputusan yang sudah diambil

| Topik | Keputusan | Sumber |
|---|---|---|
| Frontend | Next.js 16 App Router, React 19, Tailwind CSS 4, juga berperan sebagai BFF | Pemilik + Laporan |
| Backend | NestJS 12 (Core API + worker) | Pemilik + Laporan |
| Database | PostgreSQL 18 | Pemilik |
| Cache/antrean | **Valkey 9** (protokol kompatibel Redis) | Pemilik |
| ORM | Drizzle ORM | Laporan |
| Antrean pekerjaan | BullMQ di atas Valkey | Laporan |
| Login | **Email + kata sandi** (fase akun) | Pemilik |
| Ingest harga | **Layanan Python terpisah** (`services/ingest`) | Pemilik |
| Data awal | CSV tim `data/seed/prices_combined.csv` | Pemilik |
| Dua komoditas tanpa data | Kartu tetap tampil, harga "—", status "Data belum tersedia" | Pemilik |
| Pendekatan | Bertahap; Fase 1 = fondasi + seluruh halaman publik | Pemilik |
| Basis kode | Mulai dari nol | Pemilik |
| Monorepo | pnpm workspaces + Turborepo | Laporan |
| TypeScript | **6.0.x**, bukan 7.0 (typescript-eslint 8 hanya mendukung TS <6.1 dan NestJS CLI 12 mengunci ~6.0) | Usulan, berdasar cek kompatibilitas |
| Reverse proxy lokal | Traefik v3 di Docker Compose | Usulan (Laporan memakai Traefik di produksi) |

## 5. Fakta dataset (hasil audit 11 Nov 2026)

- Kolom: `comcat_id, commodity, date, price` (UTF-8, tanpa nilai kosong, tanpa duplikat).
- 3 komoditas × 1.953 hari kerja, 2 Jan 2019 – 30 Sep 2026:
  - `com_14` Cabai Merah Keriting: Rp20.000–150.000
  - `com_11` Bawang Merah Ukuran Sedang: Rp25.000–82.500
  - `com_3` Beras Kualitas Medium I: Rp11.950–16.100
- Tidak ada akhir pekan; celah terpanjang 11 hari (libur panjang). Celah **tidak diisi** (tidak ada interpolasi).
- Proporsi hari tanpa perubahan: beras 96,4%, bawang 80,9%, cabai 68,6%.
- Konsekuensi: per 11 Nov 2026 seluruh harga berstatus **terlambat** sampai ingest PIHPS berjalan. Ini perilaku yang benar, bukan bug.
- Cabai rawit hijau dan cabai rawit merah: tidak ada data (lihat §4).

## 6. Arsitektur

### 6.1 Kontainer (lokal, Docker Compose)

```
Browser ──HTTPS(lokal: http)──► Traefik :80/443
                                  │  rate limit per IP, kompresi, header keamanan,
                                  │  batas ukuran body, timeout
                                  ▼
                            web (Next.js, ≥1 replika)
                                  │  jaringan internal "backend", token layanan
                                  ▼
                            api (NestJS, stateless, ≥1 replika)
                             │            │                   │ HMAC-SHA256 + timestamp
                             ▼            ▼                   ▼
                        postgres      valkey           model-arifnet (FastAPI, placeholder,
                        (+pgbouncer)  (cache, sesi,     tidak dijalankan di Fase 1)
                                       antrean)
                             ▲            ▲
                             │            │
                     ingest (Python) ─────┘ (memicu invalidasi cache via api)
                     worker (NestJS, BullMQ: invalidasi, promosi bundel, notifikasi)
```

- Hanya Traefik yang membuka port ke host. Postgres dan Valkey hanya ada di jaringan internal. Di lokal, port DB boleh dibuka ke `127.0.0.1` saja untuk alat dev, lewat profil compose `dev-tools`.
- `api` dan `web` dibuat stateless, sehingga load balancing cukup dengan menambah replika di belakang Traefik (round-robin + health check). Simulasi beban di §11 menguji ≥2 replika.
- **PgBouncer** (transaction pooling) di depan Postgres [Usulan] agar jumlah koneksi tetap terkendali saat replika `api` bertambah.

### 6.2 Alur permintaan dan fetching data

1. **Halaman publik** (Beranda, Harga, Detail, Prediksi, Edukasi, ARIF-Net, Keterbatasan) adalah React Server Components. Next.js mengambil data dari `api` di server, bukan dari browser. Hasil fetch disimpan di cache data Next.js dengan **tag** (`prices:PIKJ`, `forecast:PIKJ`, `articles`), memakai `revalidate` cadangan (mis. 1 jam).
2. Saat ingest menulis harga baru atau bundel prediksi dipromosikan, worker memanggil endpoint revalidasi internal di `web` (bertanda tangan) yang menjalankan `revalidateTag`. Dengan begitu ribuan pengunjung dilayani dari cache, dan DB hanya disentuh **sekali per pembaruan data**, bukan per pengunjung.
3. Di `api`, setiap endpoint baca publik punya cache Valkey (cache-aside, TTL + invalidasi eksplisit) dan **single-flight**: saat cache kosong, hanya satu permintaan yang menghitung ulang, sisanya menunggu hasil yang sama. Ini mencegah cache stampede.
4. Interaksi di klien (ganti horizon prediksi, ganti rentang 30/90/365 hari) **tidak** memanggil API baru bila datanya sudah ikut dalam payload halaman. Payload prediksi memuat 8 horizon sekaligus (8 baris), jadi pindah horizon murni di sisi klien. Riwayat 365 hari ≈ 250 titik per komoditas (kecil). Bila tetap dibutuhkan fetch di klien, lewat Route Handler Next.js (BFF), bukan langsung ke `api`.
5. Respons memakai `ETag` dan `Cache-Control` yang tepat. Aset statis di-hash dan `immutable`. Kompresi dilakukan di Traefik (brotli/gzip).
6. Protokol: HTTP/2 di Traefik (HTTP/3 opsional untuk produksi). Komunikasi internal memakai HTTP/1.1 keep-alive dengan connection pool (undici) dan timeout serta retry terbatas (idempoten saja) dengan backoff.

### 6.3 Mencegah N+1 dan query berat

- Setiap endpoint baca dirancang **satu query agregat**: misalnya ringkasan Beranda (harga terakhir, Δ7 hari, Δ30 hari, sparkline 30 titik untuk 5 komoditas) dihitung dalam satu SQL dengan window function, bukan loop per komoditas.
- Drizzle relational queries / join eksplisit; dilarang memanggil query di dalam loop (diperiksa saat review, plus uji integrasi yang menghitung jumlah query per endpoint).
- Indeks: `price_observations (market_id, commodity_id, observed_on DESC)` unik; `forecasts (artifact_id, commodity_id, horizon_days)` unik.
- **Materialized view** `mv_latest_prices` di-refresh setelah ingest [Usulan] supaya ringkasan tidak menghitung ulang dari 5.859 baris yang terus bertambah.
- Semua daftar dipaginasi (keyset). Batas maksimum rentang tanggal per permintaan ditegakkan di skema validasi.
- `statement_timeout` pada role aplikasi, dan role DB dipisah: `app_rw` untuk api dan `ingest_w` untuk ingest, keduanya **bukan** superuser.

## 7. Struktur monorepo

```
kawan-pasar/                     (= folder "D:\.Capstone dan TA\Kawan Pasar")
├─ apps/
│  ├─ web/                       Next.js 16 (App Router)
│  │  └─ src/
│  │     ├─ app/                 rute (publik), layout, error/loading/not-found
│  │     ├─ components/
│  │     │  ├─ atoms/            Button, Chip, Delta, PredictionBadge, IconBox, Toggle, …
│  │     │  ├─ molecules/        CommodityCard, CommodityRow, StatCard, MetricCard, KataKapa, SelectField, HorizonPills, …
│  │     │  ├─ organisms/        NavBar, TopBar, TabBar, Footer, PriceChart, ForecastChart, ForecastTable, CoverageStrip, …
│  │     │  └─ templates/        DesktopShell, MobileShell, PageHeader layout
│  │     ├─ brand/               Logo, Kapa (7 pose, animasi), ikon komoditas & fitur, ilustrasi (diport dari assets.mjs)
│  │     ├─ lib/                 api-client (server-only), format (Rupiah, tanggal WIB, persen), env
│  │     └─ styles/              Tailwind 4 @theme dari paket tokens
│  └─ api/                       NestJS 12
│     └─ src/
│        ├─ modules/             markets, commodities, prices, forecasts, articles, health
│        │                       (fase akun: auth, users, alerts, notifications; fase analis: analyst, admin)
│        ├─ common/              guards (service-token), filters, interceptors, pipes (Zod)
│        ├─ database/            skema Drizzle, migrasi, seed
│        └─ worker/              entrypoint BullMQ terpisah (proses sendiri)
├─ packages/
│  ├─ contracts/                 skema Zod bersama (DTO, bundel prediksi) + tipe turunan
│  ├─ catalog/                   katalog komoditas & pasar (kode, nama, satuan, cakupan model)
│  ├─ tokens/                    token desain v0.4 → CSS variables / @theme Tailwind
│  ├─ tsconfig/                  konfigurasi TS strict bersama
│  └─ eslint-config/             aturan lint bersama
├─ services/
│  ├─ ingest/                    Python (uv): impor CSV sekarang, adapter PIHPS menyusul
│  └─ model-arifnet/             FastAPI: struktur + README kontrak saja (tidak dikembangkan)
├─ infra/
│  ├─ compose/                   docker-compose.yml, profil dev-tools, override lokal
│  ├─ traefik/                   konfigurasi statis & dinamis
│  └─ postgres/                  init role & ekstensi
├─ tests/
│  ├─ e2e/                       Playwright + axe (simulasi pengguna akhir lintas ukuran layar)
│  └─ load/                      skenario k6
├─ data/seed/                    dataset (tidak di-commit bila tim menghendaki; lihat §14)
├─ docs/                         knowledge base (lihat §13)
└─ figcraft-Kawan_Pasar/         prototipe (referensi, tidak diubah)
```

## 8. Model data

### Fase 1
- `markets`: `id`, `code` (unik, mis. `PIKJ`), `name`, `city`, `status` (`available` | `coming_soon`). Diisi Pasar Kramat Jati (available); Pasar Senen, Pasar Induk Tanah Tinggi, Pasar Bekasi (coming_soon, sesuai layar Pilih Pasar di prototipe).
- `commodities`: `id`, `code`, `name`, `source_ref` (mis. `com_14`, nullable), `unit` (`kg`), `model_coverage` (`covered` | `pending`), `sort_order`. Lima komoditas sesuai laporan; rawit hijau dan rawit merah `pending` tanpa `source_ref`.
- `price_observations`: `id`, `market_id`, `commodity_id`, `observed_on` (date), `price_idr` (integer rupiah, NOT NULL; observasi yang tidak ada = tidak ada baris), `source` (`seed_csv` | `pihps`), `ingest_run_id`, `created_at`. Unik (market, commodity, observed_on). Harga dalam **integer rupiah**, bukan float.
- `ingest_runs`: `id`, `source`, `started_at`, `finished_at`, `status`, `rows_inserted`, `rows_skipped`, `error` (untuk pemantauan admin nanti).
- `forecast_artifacts`: `id`, `bundle_id`, `model_name`, `model_version`, `data_version`, `preprocess_version`, `data_cutoff` (timestamptz), `issued_at`, `checksum_sha256`, `status` (`pending` | `active` | `retired` | `rejected`), `is_demo` (boolean).
- `forecasts`: `id`, `artifact_id`, `market_id`, `commodity_id`, `base_date`, `horizon_days` ∈ {1,3,7,14,30,90,180,365}, `q10_change`, `q50_change`, `q90_change` (numeric, nullable), `q10_price_idr`, `q50_price_idr`, `q90_price_idr` (nullable), `eval_status` (`available` | `partial` | `not_tested`). Monoton q10 ≤ q50 ≤ q90 ditegakkan dengan CHECK.
- `articles`: `id`, `slug`, `category` (`dasar` | `prediksi` | `arif-net` | `keterbatasan`), `title`, `summary`, `body_md`, `reading_minutes`, `published_at`, `updated_at`. Konten awal diambil dari salinan teks prototipe.

### Fase berikutnya (garis besar, didetailkan di desain fasenya)
`users` (email unik, `password_hash` Argon2id, `role`), `sessions` (disimpan di Valkey, rekam audit di DB), `alert_subscriptions`, `notifications`, `whatsapp_channels` (nomor terenkripsi di tingkat kolom), `analyst_requests`, `audit_log`.

## 9. Keamanan

Disusun mengikuti OWASP Top 10 (2025) dan ASVS level 2 sebagai daftar periksa.

| Ancaman | Penanganan |
|---|---|
| Injeksi (SQL/command) | Hanya query terparameterisasi Drizzle; SQL mentah wajib `sql\`\`` bertemplat; tidak ada eksekusi shell dari input |
| Validasi input | **Validasi ganda** dari satu sumber skema `packages/contracts`: di Next.js (form, Server Actions, Route Handlers) dan di NestJS (`ZodValidationPipe` global). Mode `strict` (properti asing ditolak), batas panjang string, enum horizon tertutup, rentang tanggal terbatas |
| XSS | React escaping; konten artikel Markdown dirender ke whitelist elemen (sanitasi), tanpa `dangerouslySetInnerHTML` mentah; CSP ketat ber-nonce (`script-src 'self' 'nonce-…' 'strict-dynamic'`, `object-src 'none'`, `base-uri 'none'`, `frame-ancestors 'none'`) |
| CSRF | Fase akun: cookie sesi `HttpOnly; Secure; SameSite=Lax`, prefiks `__Host-`, ditambah pemeriksaan Origin untuk Server Actions dan token CSRF untuk mutasi |
| Autentikasi (fase akun) | Argon2id (parameter OWASP), kebijakan kata sandi panjang minimal 12 + cek daftar kata sandi bocor (offline), rate limit login per IP dan per akun, lockout bertahap, pesan galat generik (tidak membocorkan keberadaan email), rotasi sesi setelah login, sesi dapat dicabut, reset kata sandi dengan token sekali pakai berumur pendek (di-hash di DB) |
| Kontrol akses | Default-deny; guard peran di NestJS; `api` menolak permintaan tanpa token layanan dari `web` |
| Layanan model | Internal-only; HMAC-SHA256 atas metode + path + timestamp + hash body; toleransi 60 detik; nonce anti-replay di Valkey |
| DoS / beban | Rate limit berlapis (Traefik per IP → NestJS Throttler berbasis Valkey per rute); batas ukuran body; timeout di setiap hop; pool koneksi terbatas; `statement_timeout`; cache publik melindungi DB |
| Header | HSTS (produksi), `X-Content-Type-Options`, `Referrer-Policy: strict-origin-when-cross-origin`, `Permissions-Policy` minimal, `Cross-Origin-Opener-Policy`; header `X-Powered-By` dimatikan |
| Rahasia | `.env` tidak di-commit; `.env.example` tanpa nilai; validasi env saat startup (gagal cepat); rahasia berbeda per layanan |
| Dependensi | Lockfile; `pnpm audit` dan `uv` audit di gerbang mutu; versi dipin; image Docker non-root, minimal, read-only filesystem bila memungkinkan |
| Logging | Log terstruktur (pino), ID korelasi per permintaan, **tanpa** kata sandi/token/nomor WA/email mentah; galat ke klien generik, detail hanya di log |
| Integritas bundel | Checksum SHA-256 dan validasi skema sebelum promosi; bundel gagal → `rejected`, bundel aktif tidak berubah |
| Privasi (UU PDP) | Data minimum; hak hapus akun; enkripsi kolom untuk nomor WA; retensi log terbatas |

## 10. Frontend

- **Atomic design** sesuai §7. Komponen hanya menerima props bertipe, tanpa fetch di atom/molekul. Data diambil di tingkat halaman (Server Component) lalu diturunkan.
- **Server Components lebih dulu.** Komponen klien hanya untuk interaksi: pemilih horizon, toggle rentang grafik, menu pasar, tab bar, dan animasi maskot jika perlu state. Target JS awal ≤ 170 KB per rute.
- **Grafik**: SVG buatan sendiri yang dirender di server (garis aktual solid, prediksi putus-putus, area kuantil 80%, penanda hari dasar, tooltip ringan di klien) [Usulan]. Alasannya: library grafik umum sudah memakan sebagian besar anggaran 170 KB. Grafik juga diberi ringkasan teks/tabel agar aksesibel.
- **Logo, Kapa, ikon, dan ilustrasi** diport dari `assets.mjs` menjadi komponen SVG React (tanpa berkas gambar raster).
- **Animasi Kapa**: 7 pose (Halo, Menunjuk, Prediksi, Belajar, Waspada, Senang, Istirahat), mengikuti panduan gerak v0.4 (melayang, gestur, berkedip, bubble fade + naik). Dibuat dengan CSS keyframes pada grup SVG (transform/opacity saja, aman bagi GPU), **tanpa library animasi**. Animasi dijeda bila elemen di luar viewport (IntersectionObserver) dan dimatikan saat `prefers-reduced-motion: reduce`. Maskot bersifat dekoratif (`aria-hidden`) kecuali bila menyampaikan status, yang selalu disertai teks.
- **Token**: palet "Brand v0.4" (canvas `#FAF7F0`, ink `#14201A`, green-700 `#0E4D35`, chili-600 `#E04535`, kunyit-600 `#F0A92E`, terong-600 `#6A4BD6`, dst. dari `figcraft-Kawan_Pasar/lib.mjs`), Plus Jakarta Sans + Geist Mono (angka harga, tabular), grid 8, radius sm–2xl. Font di-self-host lewat `next/font` dari berkas di `figcraft-Kawan_Pasar/fonts/` (subset latin, `display: swap`). Kontras diuji otomatis (AA).
- **Responsif**: mobile-first. Breakpoint [Usulan]: <640 (mobile, TopBar + TabBar bawah, layout layar `m_*`), 640–1023 (tablet, 2 kolom), ≥1024 (desktop, NavBar atas, layout layar `d_*`, konten maks. 1280 dengan margin 80). Diuji di 360, 390, 768, 1024, 1280, dan 1440 px. Tidak boleh ada scroll horizontal; target sentuh ≥ 44 px.
- **Format**: Rupiah `Rp 52.400` (id-ID), persen `+2,8%`, tanggal WIB. Nilai `null` → "—".
- **Enam status sistem**: prediksi menyusul, pasar belum tersedia, harga terlambat, gagal memuat (+ coba lagi), WhatsApp terhubung (fase akun), belum ada peringatan (fase akun). Dibuat sebagai komponen yang konsisten.
- **Rute Beranda** [Usulan]: `/` = Beranda Publik, yaitu orientasi kunjungan pertama ("Caranya cukup 3 langkah"). Setelah pengguna menekan "Lihat harga hari ini" atau membuka halaman lain, cookie non-identitas `kp_onboarded=1` dipasang, dan kunjungan berikutnya ke `/` dialihkan oleh middleware ke `/beranda`. Kedua halaman tetap statis dan dapat di-cache karena tidak ada render per pengguna. Rute lain: `/harga`, `/harga/[komoditas]`, `/prediksi`, `/edukasi`, `/edukasi/[slug]`, `/arif-net`, `/arif-net/keterbatasan`, `/pasar`, `/lainnya` (mobile).
- **Halaman Fase 1**: Beranda Publik (orientasi), Beranda, Harga Komoditas, Detail Komoditas (riwayat 30/90/365 hari; kartu konteks berstatus "Sinyal konteks menyusul" karena datanya belum ada), Prediksi Harga, Edukasi, Artikel, ARIF-Net Kenalan, Keterbatasan, Pilih Pasar, dan menu Lainnya (mobile). Halaman Peringatan dan Mode Analis dibuat di fase berikutnya; tautan menujunya di Fase 1 menampilkan status "segera hadir".

## 11. Performa, beban, dan pengujian

- **Anggaran**: LCP p75 ≤ 2,5 detik (profil 4G Lighthouse), JS awal ≤ 170 KB per rute (diperiksa dari laporan build), CLS < 0,1, INP < 200 ms.
- **Uji**: Vitest (unit/integrasi paket dan api, termasuk uji yang menghitung jumlah query), pytest (ingest, cakupan ≥ 90%), Playwright + axe (alur publik di 6 lebar layar, tanpa pelanggaran WCAG 2.2 AA), dan k6.
- **Simulasi beban k6** [Usulan] dengan sasaran awal yang bisa dicapai di laptop: 500 pengguna virtual serentak menjelajah halaman publik selama 5 menit, error rate < 0,5%, p95 respons < 500 ms, DB tidak disentuh untuk permintaan yang sudah ada di cache (dibuktikan lewat metrik query). Ditambah uji lonjakan (spike) dan uji bahwa rate limit memotong klien yang berlebihan dengan 429, bukan menjatuhkan server.
- **Audit per fase** (gerbang wajib sebelum lanjut):
  1. Lint + typecheck strict (nol `any`, nol galat)
  2. Seluruh uji lulus
  3. Audit dependensi
  4. Tinjauan keamanan atas perubahan
  5. Lighthouse / anggaran bundle
  6. Simulasi pengguna akhir (Playwright di browser sungguhan, berbagai ukuran layar)
  7. Uji beban

  Hasilnya ditulis di `docs/audits/fase-N.md`. Setelah itu berhenti untuk tinjauan pemilik.

## 12. Layanan pendukung

**`services/ingest` (Python, uv, Python 3.14)**
- Fase 1: perintah `import-csv` yang membaca `data/seed/prices_combined.csv`, memvalidasi (pydantic: tanggal valid, harga > 0 dan wajar, komoditas dikenal lewat katalog), memetakan `comcat_id` → komoditas, lalu upsert idempoten (`ON CONFLICT DO NOTHING`). Hasilnya dicatat di `ingest_runs`, kemudian memicu refresh materialized view dan invalidasi cache.
- Disiapkan antarmuka adapter `PriceSource` agar adapter PIHPS bisa ditambahkan tanpa mengubah alur. Adapter PIHPS sendiri **bukan** bagian Fase 1.
- Menulis langsung ke Postgres dengan role `ingest_w`, yang hanya punya hak INSERT pada `price_observations` dan `ingest_runs`.

**`services/model-arifnet` (FastAPI)**: hanya kerangka direktori, `pyproject.toml` minimal, README yang mendokumentasikan kontrak bundel (berkas prediksi, `metadata.json` berisi versi model/data/praproses/batas data, `SHA256SUMS`) dan kontrak HMAC. Tidak ada kode model dan tidak dijalankan.

**Prediksi di Fase 1**: belum ada bundel ARIF-Net. Sesuai laporan (§4.4.2), halaman Prediksi berjalan dengan **bundel demo berlabel "Data demo"** (`is_demo = true`, `model_version = "demo"`). Bundel ini dibangkitkan skrip seed dari data harga dengan metode naif yang terdokumentasi, melewati jalur verifikasi dan promosi yang sama dengan bundel asli. Label "Data demo" selalu tampil selama bundel aktif bertanda demo.

## 13. Dokumentasi (knowledge base)

```
docs/
├─ README.md                   indeks
├─ design/                     dokumen desain per fase (dokumen ini)
├─ plans/                      rencana implementasi per fase
├─ architecture/               kontainer, jaringan, alur data, keputusan (ADR bernomor)
├─ product/                    aturan produk, modul, status sistem, glosarium istilah
├─ design-system/              token, komponen atomik, maskot & gerak, responsif
├─ api/                        kontrak endpoint (dibangkitkan dari skema Zod / OpenAPI)
├─ data/                       kamus data, dataset, kontrak bundel prediksi
├─ security/                   model ancaman, daftar periksa ASVS, kebijakan rahasia
├─ operations/                 menjalankan lokal, troubleshooting, runbook
├─ testing/                    strategi uji, cara menjalankan, uji beban
└─ audits/                     laporan audit setiap fase
CONTRIBUTING.md                aturan kode bersih, konvensi, larangan atribusi AI, git oleh pemilik
CHANGELOG.md
```

Setiap keputusan teknis dicatat sebagai ADR (konteks → opsi beserta kelebihan/kekurangan → keputusan → konsekuensi).

## 14. Rencana fase

| Fase | Isi | Gerbang |
|---|---|---|
| 0 | Dokumentasi dasar, kerangka monorepo, tooling (TS strict, ESLint, Prettier, Turborepo), Docker Compose (Traefik, Postgres+PgBouncer, Valkey), skema DB + migrasi, ingest CSV, kerangka `model-arifnet` | Audit Fase 0 |
| 1 | Paket tokens/catalog/contracts, Core API publik + cache, Next.js shell + seluruh komponen atomik + brand + animasi Kapa, semua halaman publik + 6 status, bundel demo | Audit Fase 1 + simulasi pengguna + uji beban |
| 2 | Akun (email + kata sandi), Peringatan, notifikasi dalam aplikasi, ringkasan mingguan, WhatsApp (adapter tiruan lokal) | Audit Fase 2 |
| 3 | Mode Analis (unduh CSV/PNG), Admin (persetujuan peran, pemantauan ingest/artefak, konten) | Audit Fase 3 |
| 4 | Adapter ingest PIHPS, integrasi layanan model saat ARIF-Net siap | Audit Fase 4 |

Setiap fase punya rencana implementasi sendiri di `docs/plans/` sebelum dikerjakan.

## 15. Matriks versi (dicek 11 Nov 2026 dari registry)

| Package | Versi | Catatan |
|---|---|---|
| Node.js | 24 LTS (lokal 24.11) | |
| pnpm | 11.x | |
| TypeScript | 6.0.3 | TS 7.0.2 belum kompatibel dengan typescript-eslint 8 / NestJS CLI 12 |
| Next.js | 16.4.x | |
| React / React DOM | 19.3.x | |
| Tailwind CSS | 4.3.x | |
| NestJS core / CLI | 12.4.x / 12.0.x | |
| Drizzle ORM / Kit | 0.45.x / 0.31.x | driver `pg` 8.23 |
| Zod | 4.6.x | |
| BullMQ | 6.7.x | klien ioredis kompatibel Valkey |
| Vitest | 5.1.x | |
| Playwright / axe | 1.65.x / 4.14.x | |
| ESLint / typescript-eslint | 10.x / 8.72.x | |
| pino / nestjs-pino | 10.x / 5.x | |
| Argon2 | @node-rs/argon2 2.2.x | fase akun |
| PostgreSQL | 18 (alpine) | |
| Valkey | 9 (alpine) | |
| Traefik | v3 | |
| Python / uv | 3.14 / 0.13 | |
| FastAPI | 0.162.x | hanya dideklarasikan |

Versi dipin tepat di lockfile. Setiap peningkatan versi besar wajib lolos cek kompatibilitas peer dependency.

## 16. Yang diserahkan kepada pelaksana

- Rincian nama berkas, struktur internal modul, dan isi uji, selama mengikuti dokumen ini.
- Bentuk persis endpoint (didokumentasikan di `docs/api/` saat dibuat).
- Metode naif untuk bundel demo (didokumentasikan).
- Rincian visual yang diperhalus dari prototipe, selama token, hierarki, dan tata letak tetap.
- Angka rate limit awal (didokumentasikan dan dapat disetel lewat env).
