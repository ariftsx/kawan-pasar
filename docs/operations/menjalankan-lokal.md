# Menjalankan Kawan Pasar Secara Lokal

## Prasyarat

| Alat           | Versi  | Cek                                       |
| -------------- | ------ | ----------------------------------------- |
| Docker Desktop | 29.x   | `docker version`                          |
| Node.js        | 24 LTS | `node -v`                                 |
| pnpm           | 11.x   | `pnpm -v`                                 |
| Python         | 3.14   | `python --version` (untuk layanan ingest) |
| uv             | 0.13.x | `uv --version`                            |

## Langkah pertama kali

Semua perintah dijalankan dari folder root proyek. Path proyek mengandung spasi, jadi bila memakai terminal, apit path dengan tanda kutip.

```bash
pnpm install            # dependensi Node (gerbang umur rilis pnpm aktif)
pnpm env:init           # membuat .env berisi rahasia acak + URL koneksi (nilai tidak ditampilkan)
pnpm infra:up           # Traefik, PostgreSQL 18, PgBouncer, Valkey, Core API, web; menunggu sampai healthy
pnpm infra:check        # memverifikasi kontrak infrastruktur; semua baris harus OK
```

Lanjutkan dengan database dan data. Dataset tidak ada di repo: letakkan dulu `data/seed/prices_combined.csv` (lihat `data/README.md`).

```bash
pnpm --filter @kawan-pasar/api db:migrate   # skema (langsung ke PostgreSQL sebagai kp_owner)
pnpm --filter @kawan-pasar/api db:seed      # katalog komoditas & pasar (idempoten)
pnpm ingest:import                          # impor CSV seed lewat kontainer ingest
curl -s http://127.0.0.1:3001/health/ready  # Core API: {"status":"ok",...}
```

Situs web: buka **http://127.0.0.1:8080** (lewat Traefik). Halaman data dirender pada kunjungan pertama, lalu disajikan dari cache (ADR 0009).

Sejak Fase 1D web berjalan sebagai **dua replika** (`web-1`, `web-2`) dengan cache halaman bersama di Valkey basis data 1 (ADR 0010). Traefik membagi permintaan ke keduanya, dan bila satu replika mati, permintaannya diulang ke replika lain.

### Memperbarui `.env` dari fase sebelumnya

Fase 1B menambah `WEB_REVALIDATE_TOKEN`. Untuk `.env` yang sudah ada, jalankan perintah di bawah. Perintah ini hanya menambah rahasia yang belum ada, tidak mengubah nilai lama, dan tidak menyentuh volume data:

```bash
node scripts/gen-env.mjs --add-missing
```

### Mengembangkan web

```bash
pnpm --filter @kawan-pasar/web build:cache-handler   # sekali, dan setelah mengubah src/cache
API_INTERNAL_URL=http://127.0.0.1:3001 node --env-file=.env apps/web/node_modules/next/dist/bin/next dev apps/web
```

Tanpa `VALKEY_WEB_CACHE_URL`, server web lokal memakai cache memori di prosesnya sendiri.

Setelah mengubah kode web, image harus dibangun ulang agar terlihat di :8080: `node scripts/compose.mjs up -d --wait --build web-1 web-2`. Entri cache dibatasi per build (`BUILD_ID`), jadi build baru tidak pernah menyajikan halaman build lama.

> Semua perintah `docker compose` dijalankan lewat `node scripts/compose.mjs …` (atau skrip `pnpm infra:*`). Skrip itu selalu memakai kedua berkas compose; memanggil compose dengan set berkas lain akan membuat ulang kontainer tanpa port dev.

## Menjalankan uji

```bash
pnpm --filter @kawan-pasar/api db:test:reset   # wajib sebelum uji Python pertama kali (DB uji dimigrasi)
pnpm audit:all                                   # semua gerbang mutu (melakukan reset di atas sendiri)
pnpm --filter @kawan-pasar/e2e e2e               # simulasi pengguna (Playwright) lewat :8080
pnpm --filter @kawan-pasar/perf lighthouse       # anggaran Lighthouse profil seluler 4G
node scripts/loadtest.mjs browse spike edge api  # uji beban dengan CPU dibatasi (docs/testing/uji-beban.md)
```

Sekali di setiap mesin: `pnpm --filter @kawan-pasar/e2e exec playwright install chromium`.

Uji ingest (`cd services/ingest && uv run pytest`) memakai database `kawanpasar_test` yang sudah dimigrasi. Bila belum, fixture uji gagal dengan pesan yang menyebut perintah reset di atas.

## Data prediksi demo dan artikel

```bash
pnpm --filter @kawan-pasar/api bundle:demo        # bundel prediksi demo berlabel (ADR 0006)
pnpm model:export                                 # bundel ARIF-Net (ADR 0012); menggeser bundel demo
pnpm wa:balas 081234567890 STOP                   # balasan WhatsApp tiruan dari HP (ADR 0013); pesan WA tampil di Mailpit
pnpm --filter @kawan-pasar/api articles:import    # impor awal artikel ke DB kosong (sekali; setelah itu sunting di /admin)
pnpm --filter @kawan-pasar/api admin:grant <email> # jadikan akun admin (hanya dari server; cabut: admin:revoke)
pnpm --filter @kawan-pasar/api role:grant <email> analyst   # beri peran Analis tanpa halaman admin
```

## Port di mesin lokal

Semua port hanya terikat ke `127.0.0.1`, tidak terbuka ke jaringan lain.

| Layanan                   | Port host | Keterangan                                                |
| ------------------------- | --------- | --------------------------------------------------------- |
| Traefik (pintu masuk web) | 8080      | Satu-satunya pintu masuk aplikasi (situs web)             |
| PostgreSQL (langsung)     | 15432     | Untuk migrasi (`kp_owner`) dan alat dev; profil dev-tools |
| PgBouncer                 | 16432     | Jalur koneksi aplikasi dan ingest                         |
| Core API                  | 3001      | Hanya untuk alat dev; di produksi tidak terbuka           |
| Valkey cache              | 16379     |                                                           |
| Valkey antrean            | 16380     |                                                           |
| Valkey sesi               | 16381     | Sesi, lockout, rate limit akun (Fase 2A)                  |
| Mailpit (kotak masuk web) | 18025     | Email lokal: buka http://127.0.0.1:18025 (Fase 2A)        |
| Mailpit (SMTP)            | 11025     | Untuk uji integrasi worker email                          |

Port 5432, 6379, dan sejenisnya sengaja **tidak** dipakai agar tidak bentrok dengan PostgreSQL atau Redis yang mungkin sudah terpasang di Windows.

## Perintah harian

```bash
pnpm infra:up       # menyalakan
pnpm infra:down     # mematikan (data tetap tersimpan di volume)
node scripts/compose.mjs logs -f postgres   # melihat log satu layanan
node scripts/compose.mjs ps                 # status kontainer
```

## Rotasi rahasia / mulai dari nol

Password role dibuat oleh skrip init PostgreSQL **hanya saat volume data masih kosong**. Setelah rahasia dirotasi, volume harus dibuat ulang. Perintah ini **menghapus seluruh data lokal**:

```bash
node scripts/compose.mjs down -v
node scripts/gen-env.mjs --force
pnpm infra:up
```

## Troubleshooting

| Gejala                                                                    | Penyebab                                                                                          | Solusi                                                                                                                                                                                                                     |
| ------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `ports are not available … bind: An attempt was made to access a socket…` | Port host dipakai proses lain atau masuk rentang port yang dicadangkan Windows                    | Cek dengan `Get-NetTCPConnection -LocalPort <port> -State Listen` dan `netsh interface ipv4 show excludedportrange protocol=tcp`, lalu ubah port di `infra/compose/docker-compose.dev-tools.yml` dan `scripts/gen-env.mjs` |
| `pgbouncer` tidak healthy                                                 | PostgreSQL belum siap atau `PGBOUNCER_AUTH_PASSWORD` berbeda dari yang dipakai saat volume dibuat | `docker compose -p kawan-pasar logs pgbouncer`; bila password berubah, ikuti bagian rotasi                                                                                                                                 |
| `password authentication failed` setelah membuat ulang `.env`             | Volume lama menyimpan password lama                                                               | Ikuti bagian rotasi (`down -v`)                                                                                                                                                                                            |
| `pnpm install` menolak sebuah versi (`MINIMUM_RELEASE_AGE_VIOLATION`)     | Versi tersebut terlalu baru dirilis (gerbang rantai pasok)                                        | Pakai versi stabil sebelumnya; jangan menambah pengecualian tanpa ADR                                                                                                                                                      |
| Perubahan `infra/traefik/dynamic/*.yml` tidak berlaku                     | Docker Desktop di Windows tidak meneruskan event perubahan berkas bind mount ke kontainer         | `node scripts/compose.mjs restart traefik`                                                                                                                                                                                 |
| `:8080` menampilkan versi web lama                                        | Image `web-1`/`web-2` belum dibangun ulang                                                        | `node scripts/compose.mjs up -d --wait --build web-1 web-2`                                                                                                                                                                |
