import { Redis } from 'ioredis';

/** The three operations the cache handler needs; Valkey in containers, memory otherwise. */
export interface KeyValueStore {
  get(key: string): Promise<string | null>;
  mget(keys: readonly string[]): Promise<(string | null)[]>;
  set(key: string, value: string, ttlSeconds: number): Promise<void>;
}

/**
 * Valkey store. Commands fail fast while the server is unreachable (no offline queue, no retries),
 * so a cache outage turns into a cache miss instead of requests waiting on reconnects.
 */
export function createValkeyStore(
  url: string,
  onError: (msg: string) => void,
): KeyValueStore & { ready(): Promise<void>; close(): void } {
  const client = new Redis(url, {
    enableOfflineQueue: false,
    maxRetriesPerRequest: 0,
    connectTimeout: 1_000,
    commandTimeout: 1_000,
    retryStrategy: (attempt) => Math.min(attempt * 200, 2_000),
  });
  client.on('error', (e: Error) => {
    onError(`web cache connection error: ${e.message}`);
  });
  return {
    get: (key) => client.get(key),
    mget: (keys) => (keys.length === 0 ? Promise.resolve([]) : client.mget(...keys)),
    set: async (key, value, ttlSeconds) => {
      await client.set(key, value, 'EX', ttlSeconds);
    },
    ready: () =>
      client.status === 'ready'
        ? Promise.resolve()
        : new Promise((resolve) =>
            client.once('ready', () => {
              resolve();
            }),
          ),
    close: () => {
      client.disconnect();
    },
  };
}

/** Bounded in-process store for runs without Valkey (local `next start`, the build itself). */
export function createMemoryStore(maxEntries: number, now: () => number = Date.now): KeyValueStore {
  const entries = new Map<string, { value: string; expiresAt: number }>();
  const read = (key: string): string | null => {
    const hit = entries.get(key);
    if (hit === undefined) return null;
    if (hit.expiresAt <= now()) {
      entries.delete(key);
      return null;
    }
    return hit.value;
  };
  return {
    get: (key) => Promise.resolve(read(key)),
    mget: (keys) => Promise.resolve(keys.map(read)),
    set: (key, value, ttlSeconds) => {
      entries.delete(key);
      entries.set(key, { value, expiresAt: now() + ttlSeconds * 1000 });
      // Map iteration order is insertion order: the first key is the least recently written.
      while (entries.size > maxEntries) {
        const oldest = entries.keys().next();
        if (oldest.done === true) break;
        entries.delete(oldest.value);
      }
      return Promise.resolve();
    },
  };
}
