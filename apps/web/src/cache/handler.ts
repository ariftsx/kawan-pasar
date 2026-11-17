import type {
  CacheHandler,
  CacheHandlerContext,
  CacheHandlerValue,
} from 'next/dist/server/lib/incremental-cache/index.js';
import { decode, encode } from './serialize.js';
import type { KeyValueStore } from './store.js';

// Next.js ISR + data cache stored in a shared key-value store, so every web replica serves what
// any replica rendered and one tag revalidation reaches them all (ADR 0010).
//
// Freshness follows Next.js' own rules: tag state (stale/expired timestamps, the same shape as
// Next's in-process tags manifest) lives in the store, and every read copies the state of the
// entry's tags into the local manifest. Next.js then decides stale-while-revalidate versus a
// blocking re-render exactly as it does with its built-in file-system cache.

export type GetContext = Parameters<CacheHandler['get']>[1];
export type SetContext = Parameters<CacheHandler['set']>[2];
/** A cache value as Next.js passes it to `set` (null = cached 404). */
export type CacheValue = Parameters<CacheHandler['set']>[1];
type Value = CacheValue;
type CacheControl = NonNullable<CacheHandlerValue['cacheControl']>;

export interface TagRecord {
  stale?: number;
  expired?: number;
}

export interface HandlerDeps {
  store: KeyValueStore;
  /** Next.js' in-process tags manifest (a test passes its own map). */
  manifest: Map<string, TagRecord>;
  now: () => number;
  /** Upper bound for every store operation; on timeout the cache is skipped, never awaited. */
  timeoutMs: number;
  warn: (msg: string) => void;
  /**
   * Build of the running server. Entries are scoped to it: a page from an earlier build refers to
   * JavaScript chunks the new build no longer serves. Tag state stays shared across builds.
   */
  buildId: (ctx: CacheHandlerContext | undefined) => string;
}

/** Entries never outlive a week; Valkey's allkeys-lru policy bounds memory before that. */
export const MAX_ENTRY_TTL_SECONDS = 7 * 24 * 60 * 60;
/** A tag record must outlive every entry it can invalidate. */
const TAG_TTL_SECONDS = MAX_ENTRY_TTL_SECONDS + 24 * 60 * 60;
const PREFIX = 'kp:web:v1:';
const entryKey = (build: string, key: string): string => `${PREFIX}entry:${build}:${key}`;
const tagKey = (tag: string): string => `${PREFIX}tag:${tag}`;
const TAGS_HEADER = 'x-next-cache-tags';

interface StoredEntry {
  lastModified: number;
  value: Value;
  cacheControl?: CacheControl;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function parseEntry(raw: string): StoredEntry | null {
  let data: unknown;
  try {
    data = decode(raw);
  } catch {
    return null;
  }
  if (!isRecord(data) || typeof data['lastModified'] !== 'number' || !('value' in data))
    return null;
  return data as unknown as StoredEntry;
}

function parseTag(raw: string | null | undefined): TagRecord | null {
  if (raw === null || raw === undefined) return null;
  try {
    const data: unknown = JSON.parse(raw);
    if (!isRecord(data)) return null;
    const record: TagRecord = {};
    if (typeof data['stale'] === 'number') record.stale = data['stale'];
    if (typeof data['expired'] === 'number') record.expired = data['expired'];
    return record;
  } catch {
    return null;
  }
}

/** Tags an entry depends on: fetch tags + implicit page tags, or the page's tags header. */
function tagsOf(ctx: GetContext, entry: StoredEntry): string[] {
  const kind: string = ctx.kind;
  if (kind === 'FETCH' && 'tags' in ctx) return [...(ctx.tags ?? []), ...(ctx.softTags ?? [])];
  const value = entry.value;
  if (value !== null && 'headers' in value && isRecord(value.headers)) {
    const header = value.headers[TAGS_HEADER];
    if (typeof header === 'string' && header !== '') return header.split(',');
  }
  return [];
}

/**
 * Local and shared state of one tag: the later timestamp wins on each field, so a read never
 * rolls back a revalidation this replica made while its shared write was slow or failed.
 */
function mergeTag(local: TagRecord | undefined, remote: TagRecord): TagRecord {
  const later = (a: number | undefined, b: number | undefined): number | undefined =>
    a === undefined ? b : b === undefined ? a : Math.max(a, b);
  const stale = later(local?.stale, remote.stale);
  const expired = later(local?.expired, remote.expired);
  return {
    ...(stale === undefined ? {} : { stale }),
    ...(expired === undefined ? {} : { expired }),
  };
}

/** Same test as Next's `areTagsExpired`: expired now, and after the entry was written. */
function isExpired(record: TagRecord, lastModified: number, now: number): boolean {
  return record.expired !== undefined && record.expired <= now && record.expired > lastModified;
}

function cacheControlOf(ctx: SetContext): CacheControl | undefined {
  return 'cacheControl' in ctx ? ctx.cacheControl : undefined;
}

function lifetimeSeconds(ctx: SetContext): number {
  const expire = cacheControlOf(ctx)?.expire;
  return Math.max(1, Math.min(expire ?? MAX_ENTRY_TTL_SECONDS, MAX_ENTRY_TTL_SECONDS));
}

export function createCacheHandler(
  deps: HandlerDeps,
): new (ctx?: CacheHandlerContext) => CacheHandler {
  const { store, manifest, now, timeoutMs, warn, buildId } = deps;

  async function guarded<T>(what: string, op: () => Promise<T>): Promise<T | undefined> {
    let timer: ReturnType<typeof setTimeout> | undefined;
    const timeout = new Promise<never>((_, reject) => {
      timer = setTimeout(() => {
        reject(new Error(`no answer within ${String(timeoutMs)} ms`));
      }, timeoutMs);
      timer.unref();
    });
    try {
      return await Promise.race([op(), timeout]);
    } catch (e) {
      warn(`web cache ${what} skipped: ${e instanceof Error ? e.message : 'unknown error'}`);
      return undefined;
    } finally {
      clearTimeout(timer);
    }
  }

  return class SharedCacheHandler implements CacheHandler {
    readonly #build: string;

    constructor(ctx?: CacheHandlerContext) {
      this.#build = buildId(ctx);
    }

    async get(key: string, ctx: GetContext): Promise<CacheHandlerValue | null> {
      const raw = await guarded('read', () => store.get(entryKey(this.#build, key)));
      if (raw === undefined || raw === null) return null;
      const entry = parseEntry(raw);
      if (entry === null) return null;

      const tags = tagsOf(ctx, entry);
      if (tags.length > 0) {
        const records = await guarded('tag read', () => store.mget(tags.map(tagKey)));
        // Without the tag state the entry may have been revalidated elsewhere: render instead.
        if (records === undefined) return null;
        const t = now();
        for (const [i, tag] of tags.entries()) {
          const remote = parseTag(records[i]);
          if (remote === null) continue;
          const record = mergeTag(manifest.get(tag), remote);
          manifest.set(tag, record);
          if (isExpired(record, entry.lastModified, t)) return null;
        }
      }
      return {
        lastModified: entry.lastModified,
        value: entry.value,
        ...(entry.cacheControl === undefined ? {} : { cacheControl: entry.cacheControl }),
      };
    }

    async set(key: string, data: Value, ctx: SetContext): Promise<void> {
      const cacheControl = cacheControlOf(ctx);
      const entry: StoredEntry = {
        lastModified: now(),
        value: data,
        ...(cacheControl === undefined ? {} : { cacheControl }),
      };
      await guarded('write', () =>
        store.set(entryKey(this.#build, key), encode(entry), lifetimeSeconds(ctx)),
      );
    }

    /** Same state transitions as Next's file-system cache, written to the shared store. */
    async revalidateTag(tags: string | string[], durations?: { expire?: number }): Promise<void> {
      const list = typeof tags === 'string' ? [tags] : tags;
      if (list.length === 0) return;
      const t = now();
      const keys = list.map(tagKey);
      const existing = (await guarded('tag read', () => store.mget(keys))) ?? [];
      const updated = list.map((tag, i): TagRecord => {
        const prev = parseTag(existing[i]) ?? manifest.get(tag) ?? {};
        const next: TagRecord = durations
          ? {
              ...prev,
              stale: t,
              ...(durations.expire === undefined ? {} : { expired: t + durations.expire * 1000 }),
            }
          : { ...prev, expired: t };
        // This replica is correct at once, even if the shared write fails.
        manifest.set(tag, next);
        return next;
      });
      await guarded('tag write', () =>
        Promise.all(
          list.map((tag, i) => store.set(tagKey(tag), JSON.stringify(updated[i]), TAG_TTL_SECONDS)),
        ),
      );
    }

    resetRequestCache(): void {
      // No per-request memoisation to reset.
    }
  };
}
