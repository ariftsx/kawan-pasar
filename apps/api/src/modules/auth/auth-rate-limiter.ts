import { createHmac } from 'node:crypto';
import type { Redis } from 'ioredis';
import type { Clock } from '../../common/clock.js';
import { rateLimited } from '../../common/api-errors.js';

/** Account-specific limits (design Fase 2 §3), on top of the global per-route limit. */
export const AUTH_LIMITS = {
  login: { limit: 10, windowSeconds: 60 },
  emailAction: { limit: 5, windowSeconds: 3600 },
} as const;

/**
 * Fixed-window counters in valkey-session (never evicted). Keys hold HMACs, never addresses or
 * IPs in clear. Exceeding a limit throws the usual 429 with Retry-After.
 */
export class AuthRateLimiter {
  constructor(
    private readonly redis: Redis,
    private readonly secret: string,
    private readonly clock: Clock,
  ) {}

  async hit(
    name: string,
    subject: string,
    rule: { limit: number; windowSeconds: number },
  ): Promise<void> {
    const nowSeconds = Math.floor(this.clock.now().getTime() / 1000);
    const window = Math.floor(nowSeconds / rule.windowSeconds);
    const id = createHmac('sha256', this.secret).update(subject.trim().toLowerCase()).digest('hex');
    const key = `kp:v1:arl:${name}:${id}:${String(window)}`;
    const result = await this.redis
      .multi()
      .incr(key)
      .expire(key, rule.windowSeconds + 1)
      .exec();
    const count = Number(result?.[0]?.[1] ?? 0);
    if (count > rule.limit) {
      throw rateLimited(rule.windowSeconds - (nowSeconds % rule.windowSeconds));
    }
  }
}
