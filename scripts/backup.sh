#!/usr/bin/env bash
# Daily database backup on the server (Fase 5, K2). Run by cron as root:
#   scripts/backup.sh            dump both databases, keep 14 days, encrypted copy for off-site
#   scripts/backup.sh --restore-test   restore the newest dump into a scratch database and compare
# Dumps never leave the server unencrypted: the off-site copy is encrypted with the owner's age
# public key (AGE_RECIPIENT in .env); only the owner holds the private key.
set -euo pipefail
cd "$(dirname "$0")/.."

DIR=/var/backups/kawan-pasar
KEEP_DAYS=14
STAMP=$(date -u +%Y%m%dT%H%M%SZ)
PG=$(docker compose -p kawan-pasar ps -q postgres)
SUPER=$(grep -E '^POSTGRES_SUPERUSER_PASSWORD=' .env | cut -d= -f2-)
AGE_RECIPIENT=$(grep -E '^AGE_RECIPIENT=' .env | cut -d= -f2- || true)

pgx() { docker exec -e PGPASSWORD="$SUPER" -i "$PG" "$@"; }

if [[ "${1:-}" == "--restore-test" ]]; then
  latest=$(ls -1t "$DIR"/kawanpasar-*.dump | head -1)
  echo "memulihkan $latest ke basis data sementara"
  pgx psql -h 127.0.0.1 -U postgres -qc 'DROP DATABASE IF EXISTS pulih_uji' -c 'CREATE DATABASE pulih_uji'
  pgx pg_restore -h 127.0.0.1 -U postgres -d pulih_uji --no-owner --no-privileges <"$latest"
  for table in users price_observations forecast_artifacts forecasts model_candidates audit_log; do
    live=$(pgx psql -h 127.0.0.1 -U postgres -d kawanpasar -Atc "SELECT count(*) FROM $table")
    restored=$(pgx psql -h 127.0.0.1 -U postgres -d pulih_uji -Atc "SELECT count(*) FROM $table")
    printf '%-20s sekarang %8s  pulihan %8s\n' "$table" "$live" "$restored"
  done
  pgx psql -h 127.0.0.1 -U postgres -qc 'DROP DATABASE pulih_uji'
  exit 0
fi

umask 077
mkdir -p "$DIR/offsite"
for db in kawanpasar airflow; do
  out="$DIR/$db-$STAMP.dump"
  pgx pg_dump -h 127.0.0.1 -U postgres -Fc "$db" >"$out"
  test -s "$out"
  if [[ -n "$AGE_RECIPIENT" ]]; then
    age -r "$AGE_RECIPIENT" -o "$DIR/offsite/$db-$STAMP.dump.age" "$out"
  fi
done
find "$DIR" -name '*.dump' -mtime +"$KEEP_DAYS" -delete
find "$DIR/offsite" -name '*.dump.age' -mtime +"$KEEP_DAYS" -delete
echo "cadangan $STAMP selesai: $(du -sh "$DIR" | cut -f1)"
