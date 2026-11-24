#!/bin/sh
# Apache Airflow's metadata database and role (Fase 4B, ADR 0016). Idempotent: runs on a fresh
# volume (docker-entrypoint-initdb.d) and again through the one-shot `airflow-db` service for a
# volume created before Fase 4B. The airflow role owns only its own database: it cannot connect
# to kawanpasar, and the app roles cannot connect to airflow.
set -eu

if [ -z "${AIRFLOW_DB_PASSWORD:-}" ]; then
  echo "missing required env: AIRFLOW_DB_PASSWORD (node scripts/gen-env.mjs --add-missing)" >&2
  exit 1
fi

# PGHOST/PGPASSWORD are set by the one-shot service; initdb runs on the local socket.
psql -v ON_ERROR_STOP=1 --username "${POSTGRES_USER:-postgres}" --dbname postgres \
  -v airflow_pw="$AIRFLOW_DB_PASSWORD" <<'SQL'
SET password_encryption = 'scram-sha-256';
SELECT format('CREATE ROLE airflow LOGIN PASSWORD %L CONNECTION LIMIT 20', :'airflow_pw')
WHERE NOT EXISTS (SELECT FROM pg_roles WHERE rolname = 'airflow') \gexec
-- Keeps the password in step with .env when the role already exists.
SELECT format('ALTER ROLE airflow PASSWORD %L', :'airflow_pw') \gexec
SELECT 'CREATE DATABASE airflow OWNER airflow'
WHERE NOT EXISTS (SELECT FROM pg_database WHERE datname = 'airflow') \gexec
REVOKE ALL ON DATABASE airflow FROM PUBLIC;
GRANT CONNECT ON DATABASE airflow TO airflow;
SQL

for db in kawanpasar kawanpasar_test; do
  psql -v ON_ERROR_STOP=1 --username "${POSTGRES_USER:-postgres}" --dbname postgres -v db="$db" <<'SQL'
SELECT format('REVOKE ALL ON DATABASE %I FROM airflow', :'db')
WHERE EXISTS (SELECT FROM pg_database WHERE datname = :'db') \gexec
SQL
done
