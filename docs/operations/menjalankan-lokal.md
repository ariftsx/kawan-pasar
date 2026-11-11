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
pnpm infra:up           # Traefik, PostgreSQL 18, PgBouncer, Valkey (cache & antrean); menunggu sampai healthy
pnpm infra:check        # memverifikasi kontrak infrastruktur; semua baris harus OK
```

Lanjutkan dengan database dan data. Dataset tidak ada di repo: letakkan dulu `data/seed/prices_combined.csv` (lihat `data/README.md`).

```bash
pnpm --filter @kawan-pasar/api db:migrate   # skema (langsung ke PostgreSQL sebagai kp_owner)
pnpm --filter @kawan-pasar/api db:seed      # katalog komoditas & pasar (idempoten)
pnpm ingest:import                          # impor CSV seed lewat kontainer ingest
curl -s http://127.0.0.1:3001/health/ready  # Core API: {"status":"ok",...}
```

> Semua perintah `docker compose` dijalankan lewat `node scripts/compose.mjs …` (atau skrip `pnpm infra:*`). Skrip itu selalu memakai kedua berkas compose; memanggil compose dengan set berkas lain akan membuat ulang kontainer tanpa port dev.

## Port di mesin lokal

Semua port hanya terikat ke `127.0.0.1`, tidak terbuka ke jaringan lain.

| Layanan                   | Port host | Keterangan                                                |
| ------------------------- | --------- | --------------------------------------------------------- |
| Traefik (pintu masuk web) | 8080      | Satu-satunya pintu masuk aplikasi                         |
| PostgreSQL (langsung)     | 15432     | Untuk migrasi (`kp_owner`) dan alat dev; profil dev-tools |
| PgBouncer                 | 16432     | Jalur koneksi aplikasi dan ingest                         |
| Core API                  | 3001      | Hanya untuk alat dev; di produksi tidak terbuka           |
| Valkey cache              | 16379     |                                                           |
| Valkey antrean            | 16380     |                                                           |

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
