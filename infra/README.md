# infra

Infrastruktur Kawan Pasar. Saat ini berisi **stack lokal** (`compose.dev.yaml`) yang meniru bentuk produksi di docs 17 §5. Stack produksi Dokploy (`dokploy/`) menyusul saat deploy.

## Stack lokal

Prasyarat: Docker Desktop (WSL2) atau Docker Engine dengan Compose v2.

```bash
pnpm stack:env    # sekali: menulis infra/.env berisi secret acak (tidak pernah ditimpa)
pnpm stack:up     # build image, start, tunggu semua health check hijau
pnpm stack:logs   # ikuti log semua service
pnpm stack:down   # stop; tambah `-- -v` untuk menghapus volume
```

Buka http://localhost:3000. Hanya web yang dipublikasikan, dan hanya di `127.0.0.1`.

| Service        | Image                                  | Jaringan                  | Catatan                                       |
| -------------- | -------------------------------------- | ------------------------- | --------------------------------------------- |
| `web`          | `apps/web/Dockerfile`                  | `kp-internal` + `kp-edge` | Next.js standalone, `127.0.0.1:3000`          |
| `api`          | `apps/api/Dockerfile`                  | `kp-internal`             | NestJS, port 4000, tidak terjangkau dari host |
| `worker`       | image `api`, `CMD node dist/worker.js` | `kp-internal`             | Belum ada antrean                             |
| `model`        | `services/model/Dockerfile`            | `kp-internal`             | `OUTLOOK_MODE=development` (bundle DATA DEMO) |
| `postgres`     | `postgres:18.6-alpine`                 | `kp-internal`             | Volume `kp-pg`                                |
| `valkey-cache` | `valkey/valkey:9.1.2-alpine`           | `kp-internal`             | `allkeys-lru`, tanpa persistensi (P-05)       |
| `valkey-queue` | `valkey/valkey:9.1.2-alpine`           | `kp-internal`             | `noeviction` + AOF, volume `kp-queue` (P-05)  |

`kp-internal` adalah jaringan `internal: true`: container di dalamnya tidak punya akses internet, dan port-nya tidak bisa dipublikasikan ke host. Saat api membutuhkan akses keluar (Google OIDC, Web Push di F3), aksesnya dibuka secara eksplisit.

## Hardening container

Berlaku untuk web, api, worker, dan model (AGENTS §41.8, docs 15):

- user non-root (`node` uid 1000, `kp` uid 10001);
- `read_only: true`. Web hanya punya `tmpfs` untuk `/tmp` dan cache Next;
- `cap_drop: [ALL]` dan `no-new-privileges`;
- batas CPU dan memori per service;
- image dasar dipin **by digest**;
- health check di dalam image (`HEALTHCHECK`), sehingga orkestrator mana pun bisa memakainya.

Postgres dan Valkey hanya memakai `no-new-privileges`. Entrypoint resmi mereka perlu berganti user saat start.

## Image

Semua image di-build dari working tree:

```bash
docker build -f apps/web/Dockerfile -t kp-web:dev .
docker build -f apps/api/Dockerfile -t kp-api:dev .
docker build -t kp-model:dev services/model
```

- **pnpm 12** dipasang dengan `npm install -g pnpm@12.14.0` karena Corepack di Node 24.11 belum bisa menjalankan pnpm 12.
- Image api memakai `pnpm deploy --prod --legacy`, sehingga hanya dependensi produksi yang ikut.
- `NEXT_PUBLIC_*` adalah build arg karena nilainya ditanam saat build. Variabel ini bukan secret.
- Scan Trivy dan push ke GHCR menyusul di F0 PR 12.

## Secret

`infra/.env` (diabaikan git) dibuat oleh `pnpm stack:env` dengan nilai acak 32 byte (base64url). Template-nya ada di `.env.example`. Secret produksi hanya ada di Environment Dokploy.
