-- Least privilege: only the ingest role refreshes mv_latest_prices (after each run). The API
-- role is public-facing and must not be able to trigger repeated full refreshes.
REVOKE EXECUTE ON FUNCTION refresh_latest_prices() FROM app_rw;
