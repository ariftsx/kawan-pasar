# ADR 0003 — Valkey (dua instance), PgBouncer, dan Traefik

- **Status:** Diterima (11 Nov 2026)

## Konteks

Sistem harus tetap stabil saat melayani banyak pengguna. Database tidak boleh kehabisan koneksi saat replika API bertambah, cache tidak boleh menumbuhkan memori tanpa batas, dan antrean pekerjaan (BullMQ) tidak boleh kehilangan job.

## Keputusan dan opsi

### 1. Valkey 9, bukan Redis (keputusan pemilik)

| Opsi     | Kelebihan                                              | Kekurangan                                |
| -------- | ------------------------------------------------------ | ----------------------------------------- |
| Valkey 9 | Lisensi BSD, protokol kompatibel Redis, sesuai laporan | Ekosistem tool sedikit lebih kecil        |
| Redis 8  | Paling populer                                         | Lisensi lebih ketat; tidak sesuai laporan |

### 2. Dua instance Valkey

Kebijakan eviction berlaku per instance:

- `valkey-cache`: `maxmemory 256mb`, `allkeys-lru`, tanpa persistensi. Data cache boleh dibuang kapan saja.
- `valkey-queue`: `noeviction`, `appendonly yes`. BullMQ mensyaratkan job tidak pernah dibuang diam-diam.

Satu instance dengan dua nomor DB tidak cukup, karena `maxmemory-policy` berlaku untuk seluruh instance.

### 3. PgBouncer (transaction pooling)

| Opsi                                 | Kelebihan                                        | Kekurangan                                                                                                     |
| ------------------------------------ | ------------------------------------------------ | -------------------------------------------------------------------------------------------------------------- |
| Koneksi langsung dari setiap replika | Sederhana                                        | Jumlah koneksi = replika × pool, mudah melewati `max_connections`                                              |
| PgBouncer mode transaction           | Ratusan klien dilayani oleh 20–50 koneksi server | Tidak boleh memakai `SET` sesi atau advisory lock sesi; prepared statement ditangani `max_prepared_statements` |

Autentikasi memakai SCRAM lewat `auth_query`. Role `pgbouncer_auth` hanya bisa memanggil fungsi `pgbouncer.get_auth()`, yang **dibatasi** untuk role `app_rw` dan `ingest_w`. Superuser dan `kp_owner` tidak bisa login lewat PgBouncer; migrasi selalu langsung ke PostgreSQL.

### 4. Traefik v3.7 dengan file provider

Socket Docker **tidak** di-mount ke Traefik, karena akses ke socket setara akses root ke host. Rute ditulis di `infra/traefik/dynamic/*.yml`. Middleware di entrypoint `web`: header keamanan, rate limit 50 req/detik per IP (burst 100), batas 100 permintaan serentak, batas body 1 MiB, dan kompresi brotli/gzip. Dashboard dimatikan.

## Konsekuensi

- Kode yang memakai PgBouncer dilarang memakai `SET` (gunakan `SET LOCAL` di dalam transaksi atau pengaturan per role).
- Rute baru harus ditambahkan manual ke berkas dynamic Traefik.
- Batas laju di Traefik adalah lapis pertama; rate limit per rute di NestJS (Fase 1) adalah lapis kedua.
