import { createHash } from 'node:crypto';
import { Redis } from 'ioredis';
import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import type { Clock } from '../../src/common/clock.js';
import { SessionStore } from '../../src/modules/auth/session.store.js';

const redis = new Redis(process.env['VALKEY_SESSION_URL'] ?? '');
const clock = { t: Date.parse('2026-11-17T00:00:00Z') };
const fakeClock: Clock = { now: () => new Date(clock.t) };
const DAY = 86_400_000;
const store = new SessionStore(redis, fakeClock, {
  idleSeconds: 7 * 86_400,
  absoluteSeconds: 30 * 86_400,
  touchEverySeconds: 300,
});
const USER = '0190a0b0-0000-7000-8000-000000000001';

beforeEach(async () => {
  await redis.flushdb();
  clock.t = Date.parse('2026-11-17T00:00:00Z');
});

afterAll(() => {
  redis.disconnect();
});

describe('SessionStore', () => {
  it('creates a session whose token and CSRF secret are never stored in clear', async () => {
    const { token, csrf } = await store.create(USER, 'Mozilla/5.0 (Windows NT 10.0) Chrome/140');
    expect(token).toMatch(/^[A-Za-z0-9_-]{43}$/);
    expect(csrf).toMatch(/^[A-Za-z0-9_-]{43}$/);
    const keys = await redis.keys('*');
    const dump = (await Promise.all(keys.map((k) => redis.dump(k)))).join('');
    expect(keys.join(' ')).not.toContain(token);
    expect(dump).not.toContain(token);
    expect(keys).toContain(`kp:v1:sess:${createHash('sha256').update(token).digest('hex')}`);
  });

  it('reads a live session, and nothing for an unknown token', async () => {
    const { token, csrf } = await store.create(USER, 'ua');
    const s = await store.read(token);
    expect(s?.userId).toBe(USER);
    expect(s?.csrf).toBe(csrf);
    expect(await store.read('x'.repeat(43))).toBeNull();
  });

  it('ends after 7 idle days, and after 30 days in any case', async () => {
    const { token } = await store.create(USER, 'ua');
    clock.t += 6 * DAY;
    expect(await store.read(token)).not.toBeNull(); // also refreshes "last seen"
    clock.t += 6 * DAY;
    expect(await store.read(token)).not.toBeNull();
    clock.t += 7 * DAY + 1;
    expect(await store.read(token)).toBeNull();

    const busy = await store.create(USER, 'ua');
    for (let d = 0; d < 30; d += 5) {
      clock.t += 5 * DAY;
      await store.read(busy.token);
    }
    clock.t += 1;
    expect(await store.read(busy.token)).toBeNull();
  });

  it('writes "last seen" at most every 5 minutes', async () => {
    const { token } = await store.create(USER, 'ua');
    const first = (await store.read(token))?.lastSeenAt;
    clock.t += 60_000;
    expect((await store.read(token))?.lastSeenAt).toBe(first);
    clock.t += 300_000;
    expect((await store.read(token))?.lastSeenAt).not.toBe(first);
  });

  it('lists, revokes one, and revokes all but the current session', async () => {
    const a = await store.create(USER, 'Mozilla/5.0 (Macintosh) Safari/605');
    const b = await store.create(USER, 'ua');
    const c = await store.create(USER, 'ua');
    const listed = await store.list(USER, a.token);
    expect(listed).toHaveLength(3);
    expect(listed.filter((s) => s.current)).toHaveLength(1);

    const bId = listed.find((s) => !s.current && s.id === store.idOf(b.token))?.id ?? '';
    expect(await store.revokeById(USER, bId)).toBe(true);
    expect(await store.read(b.token)).toBeNull();
    expect(
      await store.revokeById('0190a0b0-0000-7000-8000-000000000999', store.idOf(c.token)),
    ).toBe(false);

    await store.revokeAll(USER, a.token);
    expect(await store.read(a.token)).not.toBeNull();
    expect(await store.read(c.token)).toBeNull();

    await store.revoke(a.token);
    expect(await store.read(a.token)).toBeNull();
    expect(await store.list(USER, a.token)).toEqual([]);
  });
});

describe('SessionStore races', () => {
  it('a session revoked while it is being read is not brought back by the "last seen" write', async () => {
    const { token } = await store.create(USER, 'ua');
    clock.t += 10 * 60_000; // due for a "last seen" write
    // The revocation lands between the read (GET) and the touch (SET).
    const racing = new Proxy(redis, {
      get(target, prop, receiver) {
        if (prop === 'get') {
          return async (key: string) => {
            const value = await target.get(key);
            await target.del(key);
            return value;
          };
        }
        const value: unknown = Reflect.get(target, prop, receiver);
        return typeof value === 'function' ? (value.bind(target) as unknown) : value;
      },
    });
    const racy = new SessionStore(racing, fakeClock, {
      idleSeconds: 7 * 86_400,
      absoluteSeconds: 30 * 86_400,
      touchEverySeconds: 300,
    });
    expect(await racy.read(token)).toBeNull();
    expect(await store.read(token)).toBeNull();
  });
});
