-- Latest price per (market, commodity) plus the reference prices used for the 7-day and
-- 30-day change. A reference is the last observation on or before (latest - N calendar days);
-- NULL when the history is shorter than that (never 0).
CREATE MATERIALIZED VIEW mv_latest_prices AS
WITH latest AS (
  SELECT DISTINCT ON (market_id, commodity_id)
         market_id, commodity_id, observed_on, price_idr
  FROM price_observations
  ORDER BY market_id, commodity_id, observed_on DESC
)
SELECT l.market_id,
       l.commodity_id,
       l.observed_on,
       l.price_idr,
       (SELECT p.price_idr FROM price_observations p
         WHERE p.market_id = l.market_id AND p.commodity_id = l.commodity_id
           AND p.observed_on <= l.observed_on - 7
         ORDER BY p.observed_on DESC LIMIT 1) AS price_7d_idr,
       (SELECT p.price_idr FROM price_observations p
         WHERE p.market_id = l.market_id AND p.commodity_id = l.commodity_id
           AND p.observed_on <= l.observed_on - 30
         ORDER BY p.observed_on DESC LIMIT 1) AS price_30d_idr
FROM latest l
WITH DATA;--> statement-breakpoint

CREATE UNIQUE INDEX mv_latest_prices_market_commodity ON mv_latest_prices (market_id, commodity_id);--> statement-breakpoint

-- Callable by the ingest role, which does not own the view. SECURITY DEFINER runs it as the
-- schema owner; search_path is pinned so the definer context cannot be hijacked.
CREATE FUNCTION refresh_latest_prices() RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
BEGIN
  REFRESH MATERIALIZED VIEW CONCURRENTLY mv_latest_prices;
END;
$$;--> statement-breakpoint

REVOKE ALL ON FUNCTION refresh_latest_prices() FROM PUBLIC;--> statement-breakpoint

-- app_rw: the Core API. Reads everything; writes only what the API owns.
GRANT SELECT ON ALL TABLES IN SCHEMA public TO app_rw;--> statement-breakpoint
GRANT SELECT ON mv_latest_prices TO app_rw;--> statement-breakpoint
GRANT INSERT, UPDATE ON forecast_artifacts, forecasts, articles TO app_rw;--> statement-breakpoint
GRANT EXECUTE ON FUNCTION refresh_latest_prices() TO app_rw;--> statement-breakpoint

-- ingest_w: the price ingest service. Append-only on observations.
GRANT SELECT ON markets, commodities TO ingest_w;--> statement-breakpoint
GRANT INSERT ON price_observations TO ingest_w;--> statement-breakpoint
GRANT SELECT, INSERT, UPDATE ON ingest_runs TO ingest_w;--> statement-breakpoint
GRANT EXECUTE ON FUNCTION refresh_latest_prices() TO ingest_w;
