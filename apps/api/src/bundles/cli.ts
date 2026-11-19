// Bundle CLI (runs with the API's app_rw credentials from .env):
//   pnpm --filter @kawan-pasar/api bundle:promote <bundle-dir>
//   pnpm --filter @kawan-pasar/api bundle:demo      (generate the labelled demo bundle, then promote)
//   pnpm --filter @kawan-pasar/api bundle:prices <file>   (full price history of the covered
//                                       commodities: the input of the ARIF-Net job, ADR 0012)
// Exit codes: 0 active / written, 2 rejected (reasons printed), 1 error / bad invocation.
import { writeFile } from 'node:fs/promises';
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
import { toPriceExportCsv } from './price-export.js';

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

/** `days`: history kept before the last observation; null keeps all of it. */
async function loadSeries(
  db: Db,
  days: number | null = SERIES_DAYS,
): Promise<Map<CommodityCode, PricePoint[]>> {
  const result = await db.execute(sql`
    WITH m AS (SELECT id FROM markets WHERE code = 'PIKJ'),
    -- Computed once (a correlated max() here would rescan the table for every row).
    since AS (
      SELECT max(p.observed_on) - ${days ?? 100_000}::int AS day
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
  if (command !== 'promote' && command !== 'demo' && command !== 'prices') {
    process.stderr.write('usage: cli.ts promote <bundle-dir> | demo | prices <file>\n');
    return 1;
  }
  if ((command === 'promote' || command === 'prices') && arg === undefined) {
    process.stderr.write(`usage: cli.ts ${command} <path>\n`);
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

    if (command === 'prices') {
      const csv = toPriceExportCsv(await loadSeries(db, null));
      // 'wx': never overwrite an existing file.
      await writeFile(arg ?? '', csv, { flag: 'wx' });
      process.stdout.write(`price file written (${String(csv.split('\n').length - 2)} rows)\n`);
      return 0;
    }

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

// exitCode, not process.exit(): exiting while ioredis/pg handles are still closing aborts Node on
// Windows (libuv assertion), turning a successful promotion into a crash exit status.
main().then(
  (code) => {
    process.exitCode = code;
  },
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
    process.exitCode = 1;
  },
);
