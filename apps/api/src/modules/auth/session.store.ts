import { createHash, randomBytes } from 'node:crypto';
import type { Redis } from 'ioredis';
import { z } from 'zod';
import type { Clock } from '../../common/clock.js';

// Sessions live in valkey-session (noeviction, ADR 0011). A session is found by the SHA-256 of
// its token, so a dump of Valkey yields no usable session. Times are checked against the clock;
// the key TTL only cleans up.

export interface SessionPolicy {
  idleSeconds: number;
  absoluteSeconds: number;
  touchEverySeconds: number;
}

export interface Session {
  /** Public id (first 16 bytes of the hash, hex): what "Sesi aktif" shows and revokes by. */
  id: string;
  userId: string;
  csrf: string;
  createdAt: string;
  lastSeenAt: string;
}

export interface SessionListItem {
  id: string;
  current: boolean;
  createdAt: string;
  lastSeenAt: string;
  device: string;
}

const Stored = z.strictObject({
  userId: z.string(),
  csrf: z.string(),
  device: z.string(),
  createdAt: z.number(),
  lastSeenAt: z.number(),
});
type Stored = z.infer<typeof Stored>;

const sessionKey = (hash: string): string => `kp:v1:sess:${hash}`;
const userKey = (userId: string): string => `kp:v1:usess:${userId}`;
const hashOf = (token: string): string => createHash('sha256').update(token).digest('hex');
const newToken = (): string => randomBytes(32).toString('base64url');

/** Coarse device label from a User-Agent: browser and OS family only (never the full string). */
export function deviceOf(userAgent: string): string {
  const browser = userAgent.includes('Edg/')
    ? 'Edge'
    : userAgent.includes('Firefox/')
      ? 'Firefox'
      : userAgent.includes('Chrome/')
        ? 'Chrome'
        : userAgent.includes('Safari/')
          ? 'Safari'
          : null;
  const os = userAgent.includes('Android')
    ? 'Android'
    : /iPhone|iPad/.test(userAgent)
      ? 'iOS'
      : userAgent.includes('Windows')
        ? 'Windows'
        : userAgent.includes('Macintosh')
          ? 'macOS'
          : userAgent.includes('Linux')
            ? 'Linux'
            : null;
  if (browser === null && os === null) return 'Perangkat lain';
  return [browser ?? 'Peramban lain', os].filter((p) => p !== null).join(' · ');
}

export class SessionStore {
  constructor(
    private readonly redis: Redis,
    private readonly clock: Clock,
    private readonly policy: SessionPolicy,
  ) {}

  idOf(token: string): string {
    return hashOf(token).slice(0, 32);
  }

  async create(userId: string, userAgent: string): Promise<{ token: string; csrf: string }> {
    const token = newToken();
    const csrf = newToken();
    const now = this.clock.now().getTime();
    const hash = hashOf(token);
    const value: Stored = {
      userId,
      csrf,
      device: deviceOf(userAgent),
      createdAt: now,
      lastSeenAt: now,
    };
    await this.redis
      .multi()
      .set(sessionKey(hash), JSON.stringify(value), 'EX', this.ttl(value, now))
      .sadd(userKey(userId), hash)
      .expire(userKey(userId), this.policy.absoluteSeconds)
      .exec();
    return { token, csrf };
  }

  /** The live session for a token, refreshing "last seen"; null when unknown or expired. */
  async read(token: string): Promise<Session | null> {
    const hash = hashOf(token);
    const stored = this.parse(await this.redis.get(sessionKey(hash)));
    if (stored === null) return null;
    const now = this.clock.now().getTime();
    if (this.expired(stored, now)) {
      await this.remove(stored.userId, hash);
      return null;
    }
    let current = stored;
    if (now - stored.lastSeenAt >= this.policy.touchEverySeconds * 1000) {
      current = { ...stored, lastSeenAt: now };
      // XX: only if the session still exists. A revocation between the GET above and this write
      // must win; an unconditional SET would bring the session back outside the user's set,
      // where no later "sign out everywhere" could reach it (Fase 2A review).
      const written = await this.redis.set(
        sessionKey(hash),
        JSON.stringify(current),
        'EX',
        this.ttl(current, now),
        'XX',
      );
      if (written === null) return null;
    }
    return {
      id: hash.slice(0, 32),
      userId: current.userId,
      csrf: current.csrf,
      createdAt: new Date(current.createdAt).toISOString(),
      lastSeenAt: new Date(current.lastSeenAt).toISOString(),
    };
  }

  async list(userId: string, currentToken: string): Promise<SessionListItem[]> {
    const hashes = await this.redis.smembers(userKey(userId));
    if (hashes.length === 0) return [];
    const values = await this.redis.mget(hashes.map(sessionKey));
    const now = this.clock.now().getTime();
    const current = hashOf(currentToken);
    const items: (SessionListItem & { at: number })[] = [];
    const stale: string[] = [];
    hashes.forEach((hash, i) => {
      const stored = this.parse(values[i] ?? null);
      if (stored?.userId !== userId || this.expired(stored, now)) {
        stale.push(hash);
        return;
      }
      items.push({
        id: hash.slice(0, 32),
        current: hash === current,
        createdAt: new Date(stored.createdAt).toISOString(),
        lastSeenAt: new Date(stored.lastSeenAt).toISOString(),
        device: stored.device,
        at: stored.lastSeenAt,
      });
    });
    if (stale.length > 0) await this.redis.srem(userKey(userId), ...stale);
    return items.sort((a, b) => b.at - a.at).map(({ at: _at, ...item }) => item);
  }

  async revoke(token: string): Promise<void> {
    const hash = hashOf(token);
    const stored = this.parse(await this.redis.get(sessionKey(hash)));
    await this.remove(stored?.userId ?? null, hash);
  }

  /** Revokes the user's session with this public id. False when it is not theirs or not found. */
  async revokeById(userId: string, id: string): Promise<boolean> {
    const hash = (await this.redis.smembers(userKey(userId))).find((h) => h.slice(0, 32) === id);
    if (hash === undefined) return false;
    await this.remove(userId, hash);
    return true;
  }

  /** Ends every session of the user, except the one holding `exceptToken` (if given). */
  async revokeAll(userId: string, exceptToken?: string): Promise<void> {
    const keep = exceptToken === undefined ? null : hashOf(exceptToken);
    const hashes = (await this.redis.smembers(userKey(userId))).filter((h) => h !== keep);
    if (hashes.length === 0) return;
    await this.redis
      .multi()
      .del(...hashes.map(sessionKey))
      .srem(userKey(userId), ...hashes)
      .exec();
  }

  private async remove(userId: string | null, hash: string): Promise<void> {
    const tx = this.redis.multi().del(sessionKey(hash));
    if (userId !== null) tx.srem(userKey(userId), hash);
    await tx.exec();
  }

  private expired(s: Stored, now: number): boolean {
    return (
      now - s.lastSeenAt > this.policy.idleSeconds * 1000 ||
      now - s.createdAt > this.policy.absoluteSeconds * 1000
    );
  }

  /** Seconds until the earlier of the idle and the absolute end (at least 1). */
  private ttl(s: Stored, now: number): number {
    const idleEnd = s.lastSeenAt + this.policy.idleSeconds * 1000;
    const absoluteEnd = s.createdAt + this.policy.absoluteSeconds * 1000;
    return Math.max(1, Math.ceil((Math.min(idleEnd, absoluteEnd) - now) / 1000));
  }

  private parse(raw: string | null): Stored | null {
    if (raw === null) return null;
    try {
      const parsed = Stored.safeParse(JSON.parse(raw));
      return parsed.success ? parsed.data : null;
    } catch {
      return null;
    }
  }
}
