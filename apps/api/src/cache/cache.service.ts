import { Inject, Injectable, Logger } from '@nestjs/common';
import type { Redis } from 'ioredis';
import type { z } from 'zod';
import { ThrottledWarning } from '../common/throttled-log.js';
import { VALKEY_CACHE } from './tokens.js';

export type CacheScope = 'prices' | 'forecasts' | 'articles';
export type InvalidateScope = CacheScope | 'all';

const PREFIX = 'kp:v1:';
const SCOPES: readonly CacheScope[] = ['prices', 'forecasts', 'articles'];

/**
 * Cache-aside over Valkey for read endpoints.
 * - Concurrent misses for one key share a single `load()` (no stampede on the database).
 * - Values are re-validated with the contract schema when read: a corrupt entry is a miss.
 * - Any Valkey failure degrades to calling `load()` directly; the cache never fails a request.
 */
@Injectable()
export class CacheService {
  private readonly log = new Logger('CacheService');
  private readonly warnings = new ThrottledWarning(10_000, (m) => {
    this.log.warn(m);
  });
  private readonly inflight = new Map<string, Promise<unknown>>();
  private readonly inflightJson = new Map<string, Promise<string>>();

  constructor(@Inject(VALKEY_CACHE) private readonly redis: Redis) {}

  async getOrLoad<T>(
    key: `${CacheScope}:${string}`,
    ttlSeconds: number,
    schema: z.ZodType<T>,
    load: () => Promise<T>,
  ): Promise<T> {
    const fullKey = PREFIX + key;
    const cached = await this.read(fullKey, schema);
    if (cached !== undefined) return cached;

    const running = this.inflight.get(fullKey);
    if (running !== undefined) return schema.parse(await running);

    const task = (async () => {
      try {
        const value = await load();
        await this.write(fullKey, value, ttlSeconds);
        return value;
      } finally {
        this.inflight.delete(fullKey);
      }
    })();
    this.inflight.set(fullKey, task);
    return task;
  }

  /**
   * Hot path for large read responses: returns the cached JSON *text* so the controller can send it
   * without parse → validate → stringify on every hit. The value is validated against the contract
   * once, when it is loaded and before it is cached. Entries are written only by this service, on
   * the internal, password-protected Valkey (ADR 0007).
   */
  async getOrLoadJson<T>(
    key: `${CacheScope}:${string}`,
    ttlSeconds: number | (() => number),
    schema: z.ZodType<T>,
    load: () => Promise<T>,
  ): Promise<string> {
    const fullKey = `${PREFIX}json:${key}`;
    try {
      const cached = await this.redis.get(fullKey);
      if (cached !== null) return cached;
    } catch (e) {
      this.warnings.warn('read', `cache read failed, loading directly: ${message(e)}`);
    }

    const running = this.inflightJson.get(fullKey);
    if (running !== undefined) return running;

    const task = (async () => {
      try {
        const value = schema.parse(await load());
        const text = JSON.stringify(value);
        // null = "not found": never cached, so user-chosen unknown keys cannot fill the cache.
        if (value === null) return text;
        const ttl = typeof ttlSeconds === 'number' ? ttlSeconds : ttlSeconds();
        try {
          await this.redis.set(fullKey, text, 'EX', ttl);
        } catch (e) {
          this.warnings.warn('write', `cache write failed: ${message(e)}`);
        }
        return text;
      } finally {
        this.inflightJson.delete(fullKey);
      }
    })();
    this.inflightJson.set(fullKey, task);
    return task;
  }

  /** Deletes every key of a scope with SCAN (never KEYS). Rate-limit counters are untouched. */
  async invalidate(scope: InvalidateScope): Promise<number> {
    const scopes = scope === 'all' ? SCOPES : [scope];
    let deleted = 0;
    // Explicit patterns (object cache and JSON-text cache). Rate-limit keys never match.
    const patterns = scopes.flatMap((s) => [`${PREFIX}${s}:*`, `${PREFIX}json:${s}:*`]);
    for (const pattern of patterns) {
      let cursor = '0';
      do {
        const [next, keys] = await this.redis.scan(cursor, 'MATCH', pattern, 'COUNT', 200);
        cursor = next;
        if (keys.length > 0) deleted += await this.redis.unlink(...keys);
      } while (cursor !== '0');
    }
    return deleted;
  }

  private async read<T>(fullKey: string, schema: z.ZodType<T>): Promise<T | undefined> {
    let raw: string | null;
    try {
      raw = await this.redis.get(fullKey);
    } catch (e) {
      this.warnings.warn('read', `cache read failed, loading directly: ${message(e)}`);
      return undefined;
    }
    if (raw === null) return undefined;
    try {
      const parsed = schema.safeParse(JSON.parse(raw));
      if (parsed.success) return parsed.data;
    } catch {
      // Not JSON: fall through and treat as a miss.
    }
    this.warnings.warn('invalid', `discarding invalid cache entry ${fullKey}`);
    return undefined;
  }

  private async write(fullKey: string, value: unknown, ttlSeconds: number): Promise<void> {
    try {
      await this.redis.set(fullKey, JSON.stringify(value), 'EX', ttlSeconds);
    } catch (e) {
      this.warnings.warn('write', `cache write failed: ${message(e)}`);
    }
  }
}

function message(e: unknown): string {
  return e instanceof Error ? e.message : 'unknown error';
}
