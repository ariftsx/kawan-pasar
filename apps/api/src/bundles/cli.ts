// Bundle CLI (runs with the API's app_rw credentials from .env):
//   pnpm --filter @kawan-pasar/api bundle:promote <bundle-dir>
//   pnpm --filter @kawan-pasar/api bundle:demo      (generate the labelled demo bundle, then promote)
// Exit codes: 0 active, 2 rejected (reasons printed), 1 error / bad invocation.
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import type { CommodityCode } from '@kawan-pasar/catalog';
import type { PricePoint } from '@kawan-pasar/contracts';
import { sql } from 'drizzle-orm';
import { Redis } from 'ioredis';
import pg from 'pg';
import { z } from 'zod';
import { CacheService } from '../cache/cache.service.js';
import { notifyApiInvalidate } from './notify-api.js';
import { createDb } from '../database/client.js';
import type { Db } from '../database/client.js';
import { promoteBundle } from './bundle-promoter.js';
import type { PromotionResult } from './bundle-promoter.js';
import { writeBundleDir } from './bundle-writer.js';
import { generateDemoBundle } from './demo-generator.js';

const ARTIFACTS_DIR = fileURLToPath(
  new URL('../../../../services/model-arifnet/artifacts/', import.meta.url),
);
/** Look-back of the demo method (730 days) plus the longest horizon (365 days). */
const SERIES_DAYS = 730 + 365;

function requireEnv(name: string): string {
  const value = process.env[name];
  if (value === undefined || value === '') throw new Error(`missing env ${name}`);
  return value;
}

const SeriesRow = z.object({
  code: z.string(),
  observed_on: z.string(),
  price_idr: z.number().int(),
});

async function loadSeries(db: Db): Promise<Map<CommodityCode, PricePoint[]>> {
  const result = await db.execute(sql`
    WITH m AS (SELECT id FROM markets WHERE code = 'PIKJ'),
    -- Computed once (a correlated max() here would rescan the table for every row).
    since AS (
      SELECT max(p.observed_on) - ${SERIES_DAYS}::int AS day
      FROM price_observations p JOIN m ON p.market_id = m.id
    )
    SELECT c.code, to_char(p.observed_on, 'YYYY-MM-DD') AS observed_on, p.price_idr
    FROM price_observations p
    JOIN m ON p.market_id = m.id
    JOIN commodities c ON c.id = p.commodity_id
    CROSS JOIN since
    WHERE c.model_coverage = 'covered' AND p.observed_on >= since.day
    ORDER BY c.code, p.observed_on`);
  const series = new Map<CommodityCode, PricePoint[]>();
  for (const r of z.array(SeriesRow).parse(result.rows)) {
    const code = r.code as CommodityCode;
    const list = series.get(code) ?? [];
    list.push({ observedOn: r.observed_on, priceIdr: r.price_idr });
    series.set(code, list);
  }
  return series;
}

async function main(): Promise<number> {
  const [command, arg] = process.argv.slice(2);
  if (command !== 'promote' && command !== 'demo') {
    process.stderr.write('usage: cli.ts promote <bundle-dir> | cli.ts demo\n');
    return 1;
  }
  if (command === 'promote' && arg === undefined) {
    process.stderr.write('usage: cli.ts promote <bundle-dir>\n');
    return 1;
  }

  const pool = new pg.Pool({
    connectionString: requireEnv('DATABASE_URL'),
    max: 2,
    connectionTimeoutMillis: 5_000,
  });
  const redis = new Redis(requireEnv('VALKEY_CACHE_URL'), {
    maxRetriesPerRequest: 1,
    connectTimeout: 3_000,
  });
  // Connection errors surface through the commands themselves (handled below).
  redis.on('error', () => undefined);

  try {
    const db = createDb(pool);
    const cache = new CacheService(redis);
    const invalidate = async (): Promise<void> => {
      try {
        await cache.invalidate('forecasts');
        await cache.invalidate('prices');
      } catch {
        // The bundle is already active; stale cache entries expire with their TTL (≤ 1 hour).
        process.stderr.write(
          'warning: cache invalidation failed; cached forecasts expire by TTL\n',
        );
      }
      const apiUrl = process.env['API_INTERNAL_URL'] ?? 'http://127.0.0.1:3001';
      const notified = await notifyApiInvalidate(apiUrl, requireEnv('SERVICE_TOKEN'), 'forecasts');
      if (!notified) {
        process.stderr.write(
          'warning: API not reachable; web pages refresh by their revalidation interval\n',
        );
      }
    };

    let dir: string;
    if (command === 'demo') {
      const bundle = generateDemoBundle(await loadSeries(db), {
        marketCode: 'PIKJ',
        now: new Date(),
      });
      dir = path.join(ARTIFACTS_DIR, bundle.metadata.bundle_id);
      await writeBundleDir(dir, bundle);
      process.stdout.write(`demo bundle written: ${bundle.metadata.bundle_id}\n`);
    } else {
      dir = arg ?? '';
    }

    const result: PromotionResult = await promoteBundle(db, dir, new Date(), invalidate);
    process.stdout.write(`${JSON.stringify(result)}\n`);
    return result.status === 'active' ? 0 : 2;
  } finally {
    redis.disconnect();
    await pool.end();
  }
}

main().then(
  (code) => process.exit(code),
  (e: unknown) => {
    // Connection strings carry passwords: redact every env value before printing.
    const secrets = [process.env['DATABASE_URL'], process.env['VALKEY_CACHE_URL']].filter(
      (v): v is string => v !== undefined && v !== '',
    );
    const cause =
      e instanceof Error && e.cause instanceof Error ? ` (cause: ${e.cause.message})` : '';
    const firstLine = e instanceof Error ? (e.message.split('\n')[0] ?? '') : '';
    const text = e instanceof Error ? `${e.name}: ${firstLine}${cause}` : 'error';
    const safe = secrets.reduce((t, s) => t.split(s).join('[redacted]'), text);
    process.stderr.write(`bundle cli failed: ${safe}\n`);
    process.exit(1);
  },
);
