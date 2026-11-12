import { fileURLToPath } from 'node:url';
import { migrate } from 'drizzle-orm/node-postgres/migrator';
import pg from 'pg';
import { seedCatalog } from '../../src/database/seed/catalog.seed.js';
import { createDb } from '../../src/database/client.js';

const MIGRATIONS = fileURLToPath(new URL('../../src/database/migrations', import.meta.url));

function requireEnv(name: string): string {
  const value = process.env[name];
  if (value === undefined || value === '') {
    throw new Error(`missing env ${name} (run: pnpm env:init)`);
  }
  return value;
}

export const testUrls = {
  owner: (): string => requireEnv('TEST_DATABASE_MIGRATION_URL'),
  app: (): string => requireEnv('TEST_DATABASE_URL'),
  ingest: (): string => requireEnv('TEST_INGEST_DATABASE_URL'),
};

/** Drops every object in the test database, re-applies all migrations and seeds the catalog. */
export async function resetTestDatabase(): Promise<void> {
  const pool = new pg.Pool({
    connectionString: testUrls.owner(),
    max: 1,
    connectionTimeoutMillis: 15_000,
  });
  try {
    await pool.query('DROP SCHEMA IF EXISTS drizzle CASCADE');
    await pool.query('DROP SCHEMA public CASCADE');
    await pool.query('CREATE SCHEMA public');
    await pool.query('GRANT USAGE ON SCHEMA public TO app_rw, ingest_w');
    const db = createDb(pool);
    await migrate(db, { migrationsFolder: MIGRATIONS });
    await seedCatalog(db);
  } finally {
    await pool.end();
  }
}

/**
 * 15 s connect timeout: from a Windows host, direct PostgreSQL connections through the Docker
 * Desktop port proxy have a long latency tail (p99 ≈ 0.8 s, spikes > 5 s under CPU load).
 * The API itself connects inside the Docker network through PgBouncer and is unaffected.
 */
export function poolFor(role: keyof typeof testUrls): pg.Pool {
  return new pg.Pool({
    connectionString: testUrls[role](),
    max: 2,
    connectionTimeoutMillis: 15_000,
  });
}

/** Runs a statement and returns the SQLSTATE it failed with, or null when it succeeded. */
export async function sqlState(
  pool: pg.Pool,
  text: string,
  values: readonly unknown[] = [],
): Promise<string | null> {
  try {
    await pool.query(text, [...values]);
    return null;
  } catch (e) {
    if (e instanceof pg.DatabaseError) return e.code ?? 'unknown';
    throw e;
  }
}
