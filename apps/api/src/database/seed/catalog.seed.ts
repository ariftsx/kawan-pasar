import { pathToFileURL } from 'node:url';
import { COMMODITIES, MARKETS } from '@kawan-pasar/catalog';
import { inArray, sql } from 'drizzle-orm';
import pg from 'pg';
import { createDb } from '../client.js';
import type { Db } from '../client.js';
import { commodities, markets } from '../schema/index.js';

/**
 * Upserts the catalog (packages/catalog) into the database. Idempotent: rows are matched
 * by their stable `code`, so ids never change between runs.
 */
export async function seedCatalog(db: Db): Promise<void> {
  await db.transaction(async (tx) => {
    await tx
      .insert(markets)
      .values(MARKETS.map((m) => ({ code: m.code, name: m.name, city: m.city, status: m.status })))
      .onConflictDoUpdate({
        target: markets.code,
        set: {
          name: sql`excluded.name`,
          city: sql`excluded.city`,
          status: sql`excluded.status`,
        },
      });

    // sort_order is unique: park the catalog rows out of range before re-applying their values.
    // Only catalog codes are parked, so rows removed from the catalog never grow (smallint).
    await tx
      .update(commodities)
      .set({ sortOrder: sql`${commodities.sortOrder} + 1000` })
      .where(
        inArray(
          commodities.code,
          COMMODITIES.map((c) => c.code),
        ),
      );
    await tx
      .insert(commodities)
      .values(
        COMMODITIES.map((c) => ({
          code: c.code,
          name: c.name,
          sourceRef: c.sourceRef,
          unit: c.unit,
          modelCoverage: c.modelCoverage,
          sortOrder: c.sortOrder,
        })),
      )
      .onConflictDoUpdate({
        target: commodities.code,
        set: {
          name: sql`excluded.name`,
          sourceRef: sql`excluded.source_ref`,
          unit: sql`excluded.unit`,
          modelCoverage: sql`excluded.model_coverage`,
          sortOrder: sql`excluded.sort_order`,
        },
      });
  });
}

async function main(): Promise<void> {
  const url = process.env['DATABASE_MIGRATION_URL'];
  if (url === undefined || url === '') throw new Error('DATABASE_MIGRATION_URL is not set');
  const pool = new pg.Pool({ connectionString: url, max: 1 });
  try {
    await seedCatalog(createDb(pool));
    process.stdout.write('catalog seeded\n');
  } finally {
    await pool.end();
  }
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? '').href) {
  await main();
}
