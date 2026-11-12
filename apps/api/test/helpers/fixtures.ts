import type pg from 'pg';

export interface FixtureObservation {
  readonly commodity: string;
  readonly date: string;
  readonly price: number;
}

/** Weekdays from `from` to `to` inclusive (YYYY-MM-DD). */
export function weekdays(from: string, to: string): string[] {
  const out: string[] = [];
  for (
    let d = new Date(`${from}T00:00:00Z`);
    d <= new Date(`${to}T00:00:00Z`);
    d.setUTCDate(d.getUTCDate() + 1)
  ) {
    const day = d.getUTCDay();
    if (day !== 0 && day !== 6) out.push(d.toISOString().slice(0, 10));
  }
  return out;
}

/** Replaces all observations of the test database with the given rows and refreshes the view. */
export async function loadObservations(
  owner: pg.Pool,
  rows: readonly FixtureObservation[],
  market = 'PIKJ',
): Promise<void> {
  await owner.query(
    'TRUNCATE price_observations, forecasts, forecast_artifacts RESTART IDENTITY CASCADE',
  );
  if (rows.length > 0) {
    await owner.query(
      `INSERT INTO price_observations (market_id, commodity_id, observed_on, price_idr, source)
       SELECT (SELECT id FROM markets WHERE code = $1), c.id, t.d, t.p, 'seed_csv'
       FROM unnest($2::text[], $3::date[], $4::int[]) AS t(code, d, p)
       JOIN commodities c ON c.code = t.code`,
      [market, rows.map((r) => r.commodity), rows.map((r) => r.date), rows.map((r) => r.price)],
    );
  }
  await owner.query('SELECT refresh_latest_prices()');
}
