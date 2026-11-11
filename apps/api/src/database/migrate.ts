import { fileURLToPath } from 'node:url';
import { migrate } from 'drizzle-orm/node-postgres/migrator';
import pg from 'pg';
import { createDb } from './client.js';

// Migrations run as the schema owner directly against PostgreSQL (never through PgBouncer).
const url = process.env['DATABASE_MIGRATION_URL'];
if (url === undefined || url === '') throw new Error('DATABASE_MIGRATION_URL is not set');

const pool = new pg.Pool({ connectionString: url, max: 1 });
try {
  await migrate(createDb(pool), {
    migrationsFolder: fileURLToPath(new URL('./migrations', import.meta.url)),
  });
  process.stdout.write('migrations applied\n');
} finally {
  await pool.end();
}
