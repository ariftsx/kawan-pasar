import type { Redis } from 'ioredis';
import type { Clock } from '../../common/clock.js';

/** Design § 1 (P2): admin sessions are shorter than normal ones, and changes need a recent password. */
export const ADMIN_POLICY = {
  idleSeconds: 2 * 3600,
  absoluteSeconds: 12 * 3600,
  confirmSeconds: 10 * 60,
} as const;

/**
 * The admin part of a session, kept next to it in valkey-session under its own key (the session
 * record itself is unchanged). Times are checked against the clock; the key TTL only cleans up.
 */
interface AdminState {
  seenAt: number;
  confirmedAt: number | null;
}

const key = (sessionId: string): string => `kp:v1:sadm:${sessionId}`;

export class AdminSessions {
  constructor(
    private readonly redis: Redis,
    private readonly clock: Clock,
  ) {}

  /**
   * Records admin activity, or reports that the admin part has expired: 12 hours after sign-in,
   * or 2 hours without admin activity (counted from sign-in until the first admin request).
   */
  async touch(sessionId: string, signedInAt: Date): Promise<'ok' | 'expired'> {
    const now = this.clock.now().getTime();
    if (now - signedInAt.getTime() > ADMIN_POLICY.absoluteSeconds * 1000) return 'expired';
    const state = await this.read(sessionId);
    const lastSeen = state?.seenAt ?? signedInAt.getTime();
    if (now - lastSeen > ADMIN_POLICY.idleSeconds * 1000) return 'expired';
    await this.write(sessionId, { seenAt: now, confirmedAt: state?.confirmedAt ?? null });
    return 'ok';
  }

  async confirm(sessionId: string): Promise<void> {
    const now = this.clock.now().getTime();
    await this.write(sessionId, { seenAt: now, confirmedAt: now });
  }

  /** The end of the confirmation window, or null when there is none (or it has passed). */
  async confirmedUntil(sessionId: string): Promise<Date | null> {
    const at = (await this.read(sessionId))?.confirmedAt ?? null;
    if (at === null) return null;
    const until = at + ADMIN_POLICY.confirmSeconds * 1000;
    return this.clock.now().getTime() <= until ? new Date(until) : null;
  }

  async end(sessionId: string): Promise<void> {
    await this.redis.del(key(sessionId));
  }

  private async read(sessionId: string): Promise<AdminState | null> {
    const raw = await this.redis.get(key(sessionId));
    if (raw === null) return null;
    try {
      const v: unknown = JSON.parse(raw);
      if (typeof v !== 'object' || v === null) return null;
      const seenAt: unknown = Reflect.get(v, 'seenAt');
      const confirmedAt: unknown = Reflect.get(v, 'confirmedAt');
      if (typeof seenAt !== 'number') return null;
      return { seenAt, confirmedAt: typeof confirmedAt === 'number' ? confirmedAt : null };
    } catch {
      return null;
    }
  }

  private async write(sessionId: string, state: AdminState): Promise<void> {
    await this.redis.set(key(sessionId), JSON.stringify(state), 'EX', ADMIN_POLICY.absoluteSeconds);
  }
}
