// @vitest-environment node
import { afterEach, describe, expect, it, vi } from 'vitest';
import { createCacheHandler, type CacheValue, type GetContext, type TagRecord } from './handler.js';
import { createMemoryStore, type KeyValueStore } from './store.js';
import { createThrottledWarn } from './warn.js';

// Next's cache kinds are `const enum`s (not usable under isolatedModules); fixtures use the same
// string values and are typed once here.
const asValue = (value: object): CacheValue => value as unknown as CacheValue;
const PAGE_CTX = { kind: 'APP_PAGE', isFallback: false } as unknown as GetContext;
const fetchCtx = (tags: string[], softTags: string[] = []): GetContext =>
  ({ kind: 'FETCH', revalidate: 600, tags, softTags }) as unknown as GetContext;

function page(html: string, tags: string): CacheValue {
  return asValue({
    kind: 'APP_PAGE',
    html,
    rscData: Buffer.from(html),
    headers: { 'x-next-cache-tags': tags },
    postponed: undefined,
    status: 200,
    segmentData: undefined,
  });
}

const fetchValue = asValue({
  kind: 'FETCH',
  data: { headers: {}, body: 'e30=', status: 200, url: 'http://api:3001/v1/prices' },
  revalidate: 600,
  tags: ['prices:PIKJ'],
});

function setup(store: KeyValueStore = createMemoryStore(100), now = { t: 1_000_000 }) {
  const warnings: string[] = [];
  const deps = {
    store,
    now: () => now.t,
    timeoutMs: 200,
    warn: (msg: string) => warnings.push(msg),
    buildId: () => 'build-1',
  };
  // Two replicas: separate handler classes and separate in-process tag manifests, one shared store.
  const manifestA = new Map<string, TagRecord>();
  const manifestB = new Map<string, TagRecord>();
  const A = createCacheHandler({ ...deps, manifest: manifestA });
  const B = createCacheHandler({ ...deps, manifest: manifestB });
  return { a: new A(), b: new B(), manifestA, manifestB, warnings, now };
}

afterEach(() => {
  vi.useRealTimers();
});

describe('shared cache handler', () => {
  it('serves a page rendered by one replica from the other', async () => {
    const { a, b } = setup();
    await a.set('/route-cache/x/$/PIKJ/beranda', page('<p>A</p>', 'prices:PIKJ'), {
      cacheControl: { revalidate: 600, expire: 31_536_000 },
    });
    const hit = await b.get('/route-cache/x/$/PIKJ/beranda', PAGE_CTX);
    expect(hit?.lastModified).toBe(1_000_000);
    expect(hit?.cacheControl).toEqual({ revalidate: 600, expire: 31_536_000 });
    const value = hit?.value as unknown as { html: string; rscData: unknown };
    expect(value.html).toBe('<p>A</p>');
    expect(Buffer.isBuffer(value.rscData)).toBe(true);
  });

  it('returns null on a miss', async () => {
    const { b } = setup();
    expect(await b.get('/nothing', PAGE_CTX)).toBeNull();
  });

  it('a stale-while-revalidate tag revalidation on one replica marks the entry stale on the other', async () => {
    const { a, b, manifestA, now } = setup();
    await a.set('/k', page('<p>lama</p>', 'prices:PIKJ,_N_T_/PIKJ/beranda'), {});
    now.t += 5_000;
    await b.revalidateTag(['prices:PIKJ'], { expire: 31_536_000 });

    const entry = await a.get('/k', PAGE_CTX);
    // Still served (stale-while-revalidate) ...
    expect(entry).not.toBeNull();
    // ... and replica A now knows the tag went stale after the entry was written, so Next.js
    // regenerates the page in the background.
    const record = manifestA.get('prices:PIKJ');
    expect(record?.stale).toBe(1_005_000);
    expect(record?.stale).toBeGreaterThan(entry?.lastModified ?? Infinity);
  });

  it('an immediate tag expiry on one replica makes the other miss', async () => {
    const { a, b, now } = setup();
    await a.set('/k', page('<p>lama</p>', 'prices:PIKJ'), {});
    now.t += 1_000;
    await b.revalidateTag('prices:PIKJ');
    now.t += 1;
    expect(await a.get('/k', PAGE_CTX)).toBeNull();
  });

  it('checks implicit page tags and data-cache soft tags too', async () => {
    const { a, b, now } = setup();
    await a.set('/k', page('<p>x</p>', 'prices:PIKJ,_N_T_/PIKJ/beranda'), {});
    await a.set('f1', fetchValue, { fetchCache: true, tags: ['prices:PIKJ'] });
    now.t += 1_000;
    await b.revalidateTag(['_N_T_/PIKJ/beranda']);
    now.t += 1;
    expect(await a.get('/k', PAGE_CTX)).toBeNull();
    expect(await a.get('f1', fetchCtx(['prices:PIKJ'], ['_N_T_/PIKJ/beranda']))).toBeNull();
    expect(await a.get('f1', fetchCtx(['prices:PIKJ']))).not.toBeNull();
  });

  it('reads all tags of an entry with one multi-get', async () => {
    const inner = createMemoryStore(100);
    const mget = vi.fn(inner.mget.bind(inner));
    const { a } = setup({ ...inner, mget });
    await a.set('/k', page('<p>x</p>', 't1,t2,t3,t4'), {});
    await a.get('/k', PAGE_CTX);
    expect(mget).toHaveBeenCalledTimes(1);
    expect(mget.mock.calls[0]?.[0]).toHaveLength(4);
  });

  it('caps the stored lifetime at 7 days and uses a shorter route expiry when given', async () => {
    const inner = createMemoryStore(100);
    const set = vi.fn(inner.set.bind(inner));
    const { a } = setup({ ...inner, set });
    await a.set('/long', page('<p>x</p>', 't'), {
      cacheControl: { revalidate: 600, expire: 31_536_000 },
    });
    await a.set('/short', page('<p>x</p>', 't'), {
      cacheControl: { revalidate: 60, expire: 3_600 },
    });
    await a.set('f', fetchValue, { fetchCache: true, tags: [] });
    expect(set.mock.calls.map((c) => c[2])).toEqual([604_800, 3_600, 604_800]);
  });
});

describe('tag state merging', () => {
  it('a read never rolls back a revalidation this replica made when the shared write failed', async () => {
    const inner = createMemoryStore(100);
    let tagWritesFail = false;
    const store: KeyValueStore = {
      ...inner,
      set: (key, value, ttl) =>
        tagWritesFail && key.startsWith('kp:web:v1:tag:')
          ? Promise.reject(new Error('timeout'))
          : inner.set(key, value, ttl),
    };
    const { a, b, manifestA, now } = setup(store);
    await b.revalidateTag(['prices:PIKJ'], { expire: 31_536_000 }); // Valkey: stale = 1_000_000
    now.t += 1_000;
    await a.set('/k', page('<p>x</p>', 'prices:PIKJ'), {}); // written at 1_001_000
    now.t += 1_000;
    tagWritesFail = true;
    await a.revalidateTag(['prices:PIKJ'], { expire: 31_536_000 }); // local only: stale = 1_002_000
    await a.get('/k', PAGE_CTX);
    expect(manifestA.get('prices:PIKJ')?.stale).toBe(1_002_000);
  });
});

describe('deployments', () => {
  it('a new build never serves pages of the previous build, but tag state is shared', async () => {
    const store = createMemoryStore(100);
    const now = { t: 1_000_000 };
    const common = { store, now: () => now.t, timeoutMs: 200, warn: () => undefined };
    const Old = createCacheHandler({ ...common, manifest: new Map(), buildId: () => 'build-1' });
    const New = createCacheHandler({ ...common, manifest: new Map(), buildId: () => 'build-2' });
    const oldReplica = new Old();
    const newReplica = new New();
    await oldReplica.set('/k', page('<p>old chunks</p>', 'prices:PIKJ'), {});
    expect(await newReplica.get('/k', PAGE_CTX)).toBeNull();
    expect(await new Old().get('/k', PAGE_CTX)).not.toBeNull();

    now.t += 1_000;
    await newReplica.revalidateTag('prices:PIKJ');
    now.t += 1;
    expect(await oldReplica.get('/k', PAGE_CTX)).toBeNull();
  });

  it('reads the build id from the context Next.js passes to the handler', async () => {
    const seen: unknown[] = [];
    const Handler = createCacheHandler({
      store: createMemoryStore(10),
      manifest: new Map(),
      now: () => 1,
      timeoutMs: 200,
      warn: () => undefined,
      buildId: (ctx) => {
        seen.push(ctx?.serverDistDir);
        return 'b';
      },
    });
    const handler = new Handler({
      serverDistDir: '/app/.next/server',
      revalidatedTags: [],
      _requestHeaders: {},
    });
    await handler.get('/k', PAGE_CTX);
    expect(seen).toEqual(['/app/.next/server']);
  });
});

describe('fail-open', () => {
  const hanging: KeyValueStore = {
    get: () => new Promise(() => undefined),
    mget: () => new Promise(() => undefined),
    set: () => new Promise(() => undefined),
  };
  const failing: KeyValueStore = {
    get: () => Promise.reject(new Error('ECONNREFUSED')),
    mget: () => Promise.reject(new Error('ECONNREFUSED')),
    set: () => Promise.reject(new Error('ECONNREFUSED')),
  };

  it('a hanging store yields a miss within the time limit, never an exception', async () => {
    const { a } = setup(hanging);
    const started = performance.now();
    await expect(a.get('/k', PAGE_CTX)).resolves.toBeNull();
    expect(performance.now() - started).toBeLessThan(250);
    await expect(a.set('/k', page('<p>x</p>', 't'), {})).resolves.toBeUndefined();
    await expect(a.revalidateTag('t')).resolves.toBeUndefined();
  });

  it('a failing store yields a miss and a warning', async () => {
    const { a, warnings } = setup(failing);
    await expect(a.get('/k', PAGE_CTX)).resolves.toBeNull();
    await expect(a.set('/k', page('<p>x</p>', 't'), {})).resolves.toBeUndefined();
    expect(warnings.length).toBeGreaterThan(0);
    expect(warnings.join(' ')).not.toMatch(/<p>/);
  });

  it('a corrupt entry is a miss', async () => {
    const store = createMemoryStore(10);
    await store.set('kp:web:v1:entry:build-1:/k', '{not json', 60);
    const { a } = setup(store);
    expect(await a.get('/k', PAGE_CTX)).toBeNull();
  });
});

describe('throttled warning', () => {
  it('writes at most one line per interval and reports how many were suppressed', () => {
    const lines: string[] = [];
    const clock = { t: 0 };
    const warn = createThrottledWarn(
      (l) => lines.push(l),
      10_000,
      () => clock.t,
    );
    warn('cache down');
    warn('cache down');
    warn('cache down');
    clock.t = 9_999;
    warn('cache down');
    expect(lines).toHaveLength(1);
    clock.t = 10_000;
    warn('cache down');
    expect(lines).toHaveLength(2);
    expect(lines[1]).toContain('"suppressed":3');
    expect(JSON.parse(lines[0] ?? '{}')).toMatchObject({
      level: 'warn',
      service: 'web',
      msg: 'cache down',
    });
  });
});

describe('memory store (no Valkey configured)', () => {
  it('expires entries after their lifetime and evicts the oldest beyond capacity', async () => {
    const clock = { t: 0 };
    const store = createMemoryStore(2, () => clock.t);
    await store.set('a', '1', 10);
    await store.set('b', '2', 10);
    await store.set('c', '3', 10);
    expect(await store.mget(['a', 'b', 'c'])).toEqual([null, '2', '3']);
    clock.t = 10_001;
    expect(await store.get('b')).toBeNull();
  });
});
