#!/bin/sh
# Runs once on first container start (empty data volume) as the superuser.
# Creates databases and least-privilege roles. Table-level grants live in migrations.
set -eu

for v in KP_OWNER_PASSWORD APP_RW_PASSWORD INGEST_W_PASSWORD PGBOUNCER_AUTH_PASSWORD; do
  eval "val=\${$v:-}"
  if [ -z "$val" ]; then echo "missing required env: $v" >&2; exit 1; fi
done

psql -v ON_ERROR_STOP=1 --username "$POSTGRES_USER" --dbname postgres \
  -v kp_owner_pw="$KP_OWNER_PASSWORD" \
  -v app_rw_pw="$APP_RW_PASSWORD" \
  -v ingest_w_pw="$INGEST_W_PASSWORD" \
  -v pgb_pw="$PGBOUNCER_AUTH_PASSWORD" <<'SQL'
SET password_encryption = 'scram-sha-256';
CREATE ROLE kp_owner LOGIN PASSWORD :'kp_owner_pw' CONNECTION LIMIT 10;
CREATE ROLE app_rw LOGIN PASSWORD :'app_rw_pw' CONNECTION LIMIT 60;
CREATE ROLE ingest_w LOGIN PASSWORD :'ingest_w_pw' CONNECTION LIMIT 5;
CREATE ROLE pgbouncer_auth LOGIN PASSWORD :'pgb_pw' CONNECTION LIMIT 5;
ALTER ROLE app_rw SET statement_timeout = '5s';
ALTER ROLE app_rw SET idle_in_transaction_session_timeout = '10s';
ALTER ROLE ingest_w SET statement_timeout = '60s';
ALTER ROLE ingest_w SET timezone = 'Asia/Jakarta';
ALTER ROLE app_rw SET timezone = 'Asia/Jakarta';
CREATE DATABASE kawanpasar OWNER kp_owner;
CREATE DATABASE kawanpasar_test OWNER kp_owner;
SQL


for db in kawanpasar kawanpasar_test; do
  psql -v ON_ERROR_STOP=1 --username "$POSTGRES_USER" --dbname "$db" -v db="$db" <<'SQL'
REVOKE ALL ON DATABASE :"db" FROM PUBLIC;
GRANT CONNECT ON DATABASE :"db" TO kp_owner, app_rw, ingest_w, pgbouncer_auth;
REVOKE ALL ON SCHEMA public FROM PUBLIC;
ALTER SCHEMA public OWNER TO kp_owner;
GRANT USAGE ON SCHEMA public TO app_rw, ingest_w;
-- PgBouncer auth_query: lets the pooler look up SCRAM secrets without superuser.
CREATE SCHEMA pgbouncer AUTHORIZATION postgres;
REVOKE ALL ON SCHEMA pgbouncer FROM PUBLIC;
GRANT USAGE ON SCHEMA pgbouncer TO pgbouncer_auth;
CREATE FUNCTION pgbouncer.get_auth(p_usename text)
RETURNS TABLE (usename name, passwd text)
LANGUAGE sql SECURITY DEFINER SET search_path = pg_catalog AS $$
  SELECT usename, passwd FROM pg_catalog.pg_shadow
  WHERE usename = p_usename AND usename IN ('app_rw', 'ingest_w');
$$;
REVOKE ALL ON FUNCTION pgbouncer.get_auth(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION pgbouncer.get_auth(text) TO pgbouncer_auth;
SQL
done
