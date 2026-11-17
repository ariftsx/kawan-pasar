// Entry point Next.js loads as `cacheHandler` (next.config.ts). Next imports this file as-is at
// run time, so it is compiled to plain JavaScript before `next build` (tsconfig.cache-handler.json)
// and must not use the app's path aliases or `server-only`.
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { tagsManifest } from 'next/dist/server/lib/incremental-cache/tags-manifest.external.js';
import { createCacheHandler } from './handler.js';
import { createMemoryStore, createValkeyStore } from './store.js';
import { createThrottledWarn } from './warn.js';

/** Cache operations wait at most this long; afterwards the page is rendered without the cache. */
export const CACHE_TIMEOUT_MS = 200;
const MEMORY_ENTRIES = 1_000;

const warn = createThrottledWarn((line) => process.stderr.write(`${line}\n`));
const url = process.env['VALKEY_WEB_CACHE_URL'];

// One connection per server process; Next.js constructs the handler class once per request.
const store =
  url === undefined || url === ''
    ? createMemoryStore(MEMORY_ENTRIES)
    : createValkeyStore(url, warn);

const buildIds = new Map<string, string>();

/** `.next/BUILD_ID` next to the server output Next.js passes in (read once per directory). */
function buildIdOf(serverDistDir: string | undefined): string {
  if (serverDistDir === undefined) return 'unknown';
  let id = buildIds.get(serverDistDir);
  if (id === undefined) {
    try {
      id = readFileSync(path.join(serverDistDir, '..', 'BUILD_ID'), 'utf8').trim();
    } catch {
      warn('web cache: BUILD_ID not found, entries are not scoped to a build');
      id = 'unknown';
    }
    buildIds.set(serverDistDir, id);
  }
  return id;
}

export default createCacheHandler({
  store,
  manifest: tagsManifest,
  now: Date.now,
  timeoutMs: CACHE_TIMEOUT_MS,
  warn,
  buildId: (ctx) => buildIdOf(ctx?.serverDistDir),
});
