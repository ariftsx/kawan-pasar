import { createHmac } from 'node:crypto';
import type { Redis } from 'ioredis';
import { LOCKOUT_STEPS, LOCKOUT_WINDOW_SECONDS } from './policy.js';

export type LockState = { locked: false } | { locked: true; retryAfter: number };

/**
 * Progressive lockout per account (design Fase 2 §3): 5 failures → 1 minute, 10 → 15 minutes,
 * 20 → 1 hour. Keyed by an HMAC of the normalised e-mail, so Valkey never holds the address,
 * and it also locks addresses that have no account (no difference an attacker could observe).
 */
export class LockoutService {
  constructor(
    private readonly redis: Redis,
    private readonly secret: string,
  ) {}

  async check(email: string): Promise<LockState> {
    const ttl = await this.redis.ttl(this.lockKey(email));
    return ttl > 0 ? { locked: true, retryAfter: ttl } : { locked: false };
  }

  async fail(email: string): Promise<void> {
    const counter = this.counterKey(email);
    const result = await this.redis
      .multi()
      .incr(counter)
      .expire(counter, LOCKOUT_WINDOW_SECONDS)
      .exec();
    const failures = Number(result?.[0]?.[1] ?? 0);
    const step = LOCKOUT_STEPS.find(([threshold]) => failures >= threshold);
    if (step !== undefined) await this.redis.set(this.lockKey(email), '1', 'EX', step[1]);
  }

  async reset(email: string): Promise<void> {
    await this.redis.del(this.counterKey(email), this.lockKey(email));
  }

  private id(email: string): string {
    return createHmac('sha256', this.secret).update(email.trim().toLowerCase()).digest('hex');
  }

  private counterKey(email: string): string {
    return `kp:v1:lockfail:${this.id(email)}`;
  }

  private lockKey(email: string): string {
    return `kp:v1:lock:${this.id(email)}`;
  }
}
