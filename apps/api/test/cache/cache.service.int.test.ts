import { setTimeout as delay } from 'node:timers/promises';
import { Redis } from 'ioredis';
import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import { z } from 'zod';
import { CacheService } from '../../src/cache/cache.service.js';

const Value = z.strictObject({ v: z.number() });

// Offline queue on: the test client may be used before its first connection completes.
const redis = new Redis(process.env['VALKEY_CACHE_URL'] ?? '');
const cache = new CacheService(redis);

beforeEach(async () => {
  const keys = await redis.keys('kp:v1:test-*');
  if (keys.length > 0) await redis.del(...keys);
  await cache.invalidate('all');
});

afterAll(() => {
  redis.disconnect();
});

function countingLoader(value: number): {
  load: () => Promise<{ v: number }>;
  calls: () => number;
} {
  let calls = 0;
  return {
    load: async () => {
      calls += 1;
      await delay(50);
      return { v: value };
    },
    calls: () => calls,
  };
}

describe('CacheService.getOrLoad', () => {
  it('collapses 200 concurrent misses into a single load (no stampede)', async () => {
    const loader = countingLoader(7);
    const results = await Promise.all(
      Array.from({ length: 200 }, () => cache.getOrLoad('prices:stampede', 60, Value, loader.load)),
    );
    expect(loader.calls()).toBe(1);
    expect(new Set(results.map((r) => r.v))).toEqual(new Set([7]));
  });

  it('serves later calls from Valkey without loading again', async () => {
    const loader = countingLoader(3);
    await cache.getOrLoad('prices:warm', 60, Value, loader.load);
    expect(await cache.getOrLoad('prices:warm', 60, Value, loader.load)).toEqual({ v: 3 });
    expect(loader.calls()).toBe(1);
  });

  it('treats a cached value that fails the schema as a miss and overwrites it', async () => {
    await redis.set('kp:v1:prices:corrupt', JSON.stringify({ x: 1 }));
    const loader = countingLoader(5);
    expect(await cache.getOrLoad('prices:corrupt', 60, Value, loader.load)).toEqual({ v: 5 });
    expect(loader.calls()).toBe(1);
    expect(JSON.parse((await redis.get('kp:v1:prices:corrupt')) ?? 'null')).toEqual({ v: 5 });
  });

  it('applies the TTL to stored values', async () => {
    await cache.getOrLoad('prices:ttl', 120, Value, countingLoader(1).load);
    const ttl = await redis.ttl('kp:v1:prices:ttl');
    expect(ttl).toBeGreaterThan(100);
    expect(ttl).toBeLessThanOrEqual(120);
  });

  it('still answers from the loader when Valkey is unreachable', async () => {
    const down = new Redis('redis://:pw@127.0.0.1:1/0', {
      enableOfflineQueue: false,
      maxRetriesPerRequest: 0,
      lazyConnect: true,
    });
    down.on('error', () => undefined);
    const degraded = new CacheService(down);
    expect(await degraded.getOrLoad('prices:down', 60, Value, countingLoader(9).load)).toEqual({
      v: 9,
    });
    down.disconnect();
  });
});

describe('CacheService.invalidate', () => {
  it('deletes only the keys of the requested scope', async () => {
    await cache.getOrLoad('prices:a', 60, Value, countingLoader(1).load);
    await cache.getOrLoad('forecasts:a', 60, Value, countingLoader(2).load);
    expect(await cache.invalidate('prices')).toBe(1);
    expect(await redis.exists('kp:v1:prices:a')).toBe(0);
    expect(await redis.exists('kp:v1:forecasts:a')).toBe(1);
  });

  it('never deletes rate-limit counters, even for scope all', async () => {
    await redis.set('kp:v1:ratelimit:test-keep', '1', 'EX', 60);
    await cache.invalidate('all');
    expect(await redis.exists('kp:v1:ratelimit:test-keep')).toBe(1);
    await redis.del('kp:v1:ratelimit:test-keep');
  });
});

describe('CacheService.getOrLoadJson (hot path: cached JSON text is sent as-is)', () => {
  it('returns the cached JSON text without loading again', async () => {
    const loader = countingLoader(4);
    const first = await cache.getOrLoadJson('prices:raw', 60, Value, loader.load);
    const second = await cache.getOrLoadJson('prices:raw', 60, Value, loader.load);
    expect(JSON.parse(first)).toEqual({ v: 4 });
    expect(second).toBe(first);
    expect(loader.calls()).toBe(1);
  });

  it('validates a freshly loaded value against the contract before caching it', async () => {
    const WholeValue = z.strictObject({ v: z.number().int() });
    const fractional = async (): Promise<{ v: number }> => Promise.resolve({ v: 1.5 });
    await expect(
      cache.getOrLoadJson('prices:invalid', 60, WholeValue, fractional),
    ).rejects.toThrow();
    expect(await redis.exists('kp:v1:prices:invalid')).toBe(0);
  });

  it('collapses concurrent misses into one load', async () => {
    const loader = countingLoader(6);
    await Promise.all(
      Array.from({ length: 100 }, () =>
        cache.getOrLoadJson('prices:raw-stampede', 60, Value, loader.load),
      ),
    );
    expect(loader.calls()).toBe(1);
  });

  it('still answers from the loader when Valkey is unreachable', async () => {
    const down = new Redis('redis://:pw@127.0.0.1:1/0', {
      enableOfflineQueue: false,
      maxRetriesPerRequest: 0,
      lazyConnect: true,
    });
    down.on('error', () => undefined);
    const text = await new CacheService(down).getOrLoadJson(
      'prices:raw-down',
      60,
      Value,
      countingLoader(8).load,
    );
    expect(JSON.parse(text)).toEqual({ v: 8 });
    down.disconnect();
  });
});

describe('CacheService.invalidate with JSON-text entries', () => {
  it('removes JSON-text entries of the scope and keeps rate-limit keys that look similar', async () => {
    await cache.getOrLoadJson('prices:x', 60, Value, countingLoader(1).load);
    await redis.set('kp:v1:ratelimit:prices:x', '1', 'EX', 60);
    expect(await cache.invalidate('prices')).toBe(1);
    expect(await redis.exists('kp:v1:json:prices:x')).toBe(0);
    expect(await redis.exists('kp:v1:ratelimit:prices:x')).toBe(1);
    await redis.del('kp:v1:ratelimit:prices:x');
  });
});

describe('CacheService.getOrLoadJson with null results', () => {
  it('does not cache null (unknown keys from user input never fill the cache)', async () => {
    const NullableValue = Value.nullable();
    let calls = 0;
    const load = async (): Promise<{ v: number } | null> => {
      calls += 1;
      return Promise.resolve(null);
    };
    expect(await cache.getOrLoadJson('articles:item:nope', 60, NullableValue, load)).toBe('null');
    expect(await cache.getOrLoadJson('articles:item:nope', 60, NullableValue, load)).toBe('null');
    expect(calls).toBe(2);
    expect(await redis.exists('kp:v1:json:articles:item:nope')).toBe(0);
  });

  it('accepts a TTL computed after loading', async () => {
    await cache.getOrLoadJson('prices:ttl-fn', () => 42, Value, countingLoader(1).load);
    const ttl = await redis.ttl('kp:v1:json:prices:ttl-fn');
    expect(ttl).toBeGreaterThan(30);
    expect(ttl).toBeLessThanOrEqual(42);
  });
});
