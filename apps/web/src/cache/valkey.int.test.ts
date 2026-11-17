import { Redis } from 'ioredis';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createCacheHandler, type CacheValue, type GetContext, type TagRecord } from './handler.js';
import { createValkeyStore } from './store.js';

const url = process.env['TEST_VALKEY_WEB_CACHE_URL'];
if (url === undefined)
  throw new Error('VALKEY_CACHE_URL missing: run `pnpm env:init` and `pnpm infra:up`');

const PAGE_CTX = { kind: 'APP_PAGE', isFallback: false } as unknown as GetContext;
const page = (html: string, tags: string): CacheValue =>
  ({
    kind: 'APP_PAGE',
    html,
    rscData: Buffer.from([0, 159, 255, 1]),
    headers: { 'x-next-cache-tags': tags },
    postponed: undefined,
    status: 200,
    segmentData: new Map([['/_tree', Buffer.from([7, 7])]]),
  }) as unknown as CacheValue;

const stores: ReturnType<typeof createValkeyStore>[] = [];

function replica(storeUrl: string, warnings: string[] = []) {
  const store = createValkeyStore(storeUrl, (m) => warnings.push(m));
  stores.push(store);
  const Handler = createCacheHandler({
    store,
    manifest: new Map<string, TagRecord>(),
    now: Date.now,
    timeoutMs: 200,
    warn: (m) => warnings.push(m),
    buildId: () => 'int-test',
  });
  return { handler: new Handler(), store };
}

const admin = new Redis(url, { lazyConnect: true });

beforeAll(async () => {
  await admin.connect();
  await admin.flushdb();
});

afterAll(async () => {
  await admin.flushdb();
  admin.disconnect();
  for (const store of stores) store.close();
});

describe('shared cache handler on Valkey', () => {
  it('replica B serves, byte for byte, what replica A stored, and both see a revalidation', async () => {
    const { handler: a, store: storeA } = replica(url);
    const { handler: b, store: storeB } = replica(url);
    await Promise.all([storeA.ready(), storeB.ready()]);
    await a.set('/route-cache/t/$/PIKJ/harga', page('<p>Rp 45.000</p>', 'prices:PIKJ'), {
      cacheControl: { revalidate: 600, expire: 31_536_000 },
    });
    const hit = await b.get('/route-cache/t/$/PIKJ/harga', PAGE_CTX);
    const value = hit?.value as unknown as {
      html: string;
      rscData: Buffer;
      segmentData: Map<string, Buffer>;
    };
    expect(value.html).toBe('<p>Rp 45.000</p>');
    expect(value.rscData.equals(Buffer.from([0, 159, 255, 1]))).toBe(true);
    expect(value.segmentData.get('/_tree')?.equals(Buffer.from([7, 7]))).toBe(true);
    expect(await admin.ttl('kp:web:v1:entry:int-test:/route-cache/t/$/PIKJ/harga')).toBeGreaterThan(
      604_000,
    );

    await new Promise((r) => setTimeout(r, 5));
    await b.revalidateTag('prices:PIKJ');
    await new Promise((r) => setTimeout(r, 5));
    expect(await a.get('/route-cache/t/$/PIKJ/harga', PAGE_CTX)).toBeNull();
  });

  it('an unreachable Valkey is a fast miss, not an error', async () => {
    const dead = new URL(url);
    dead.port = '1';
    const warnings: string[] = [];
    const { handler } = replica(dead.href, warnings);
    const started = performance.now();
    await expect(handler.get('/route-cache/t/$/PIKJ/harga', PAGE_CTX)).resolves.toBeNull();
    expect(performance.now() - started).toBeLessThan(250);
    await expect(handler.set('/x', page('<p>x</p>', 't'), {})).resolves.toBeUndefined();
    expect(warnings.length).toBeGreaterThan(0);
    expect(warnings.join(' ')).not.toContain(dead.password);
  });
});
