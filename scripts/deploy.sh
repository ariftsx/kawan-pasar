#!/usr/bin/env bash
# Production deploy on the server (Fase 5, ADR 0018). Run from the repository on the VPS:
#   scripts/deploy.sh             pull main, build, migrate, start, check
#   scripts/deploy.sh --rollback  go back to the images of the previous deploy
# Database migrations are forward-only: a rollback restores the previous images, not the schema
# (every migration so far only adds). Never run on a developer machine.
set -euo pipefail
cd "$(dirname "$0")/.."

compose() { node scripts/compose.mjs --prod "$@"; }
# Images built from this repository; the previous deploy's copy is kept as :previous.
IMAGES=(kawan-pasar/api kawan-pasar/web kawan-pasar/airflow)
SITE_HOST=$(grep -E '^SITE_HOST=' .env | cut -d= -f2-)

log() { printf '\n== %s\n' "$*"; }

check() {
  log "pemeriksaan"
  compose ps --format '{{.Name}} {{.Status}}' | grep -v ' (healthy)$' | grep -v 'airflow-dag-processor' || true
  # Through Traefik on this machine, with the real certificate and host name.
  curl -fsS -o /dev/null -w 'beranda HTTPS: %{http_code}\n' --resolve "$SITE_HOST:443:127.0.0.1" \
    "https://$SITE_HOST/"
  curl -fsS -o /dev/null -w 'API lewat web: %{http_code}\n' --resolve "$SITE_HOST:443:127.0.0.1" \
    "https://$SITE_HOST/harga"
}

start() {
  log "menyalakan layanan"
  compose up -d --wait
  compose --profile airflow up -d --wait airflow-api-server airflow-scheduler airflow-dag-processor
}

if [[ "${1:-}" == "--rollback" ]]; then
  for image in "${IMAGES[@]}"; do
    docker image inspect "$image:previous" >/dev/null
    docker tag "$image:previous" "$image:local"
  done
  start
  check
  log "rollback selesai"
  exit 0
fi

log "kode"
if [[ -n "$(git status --porcelain --untracked-files=no)" ]]; then
  echo "ada perubahan lokal di server; deploy dibatalkan" >&2
  exit 1
fi
git pull --ff-only
git log -1 --format='commit %h %s'

log "dependensi (CLI admin di server)"
pnpm install --frozen-lockfile
pnpm --filter "./packages/**" build

log "menyimpan image saat ini sebagai :previous"
for image in "${IMAGES[@]}"; do
  if docker image inspect "$image:local" >/dev/null 2>&1; then
    docker tag "$image:local" "$image:previous"
  fi
done

log "build (satu per satu: 2 vCPU)"
COMPOSE_PARALLEL_LIMIT=1 compose build api
COMPOSE_PARALLEL_LIMIT=1 compose build web-1
docker build -f services/pipeline/airflow/Dockerfile -t kawan-pasar/airflow:local services

log "migrasi"
pnpm --filter @kawan-pasar/api db:migrate

start
check
log "deploy selesai"
