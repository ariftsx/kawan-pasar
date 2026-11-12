import { Inject, Injectable, Logger } from '@nestjs/common';
import type { CanActivate, ExecutionContext } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import type { FastifyRequest } from 'fastify';
import type { Redis } from 'ioredis';
import { VALKEY_CACHE } from '../cache/tokens.js';
import { ENV } from '../config/config.module.js';
import type { Env } from '../config/env.js';
import { rateLimited } from './api-errors.js';
import { rateLimitBucket } from './client-ip.js';
import { IS_PUBLIC } from './public.decorator.js';
import { ThrottledWarning } from './throttled-log.js';

const WINDOW_SECONDS = 60;

/**
 * Second rate-limit layer (Traefik is the first): a fixed 60-second window per client and route
 * group, counted in Valkey so every API replica shares it. If Valkey is unavailable the guard
 * fails open and logs: availability wins, and the edge limit still applies.
 */
@Injectable()
export class RateLimitGuard implements CanActivate {
  private readonly log = new Logger('RateLimitGuard');
  private readonly warnings = new ThrottledWarning(10_000, (m) => {
    this.log.warn(m);
  });
  private readonly limit: number;
  private readonly internalLimit: number;
  private readonly trustedProxies: ReadonlySet<string>;

  constructor(
    @Inject(ENV) env: Env,
    @Inject(VALKEY_CACHE) private readonly cache: Redis,
    private readonly reflector: Reflector,
  ) {
    this.limit = env.RATE_LIMIT_PER_MINUTE;
    this.internalLimit = env.RATE_LIMIT_INTERNAL_PER_MINUTE;
    this.trustedProxies = new Set(env.TRUSTED_PROXY_IPS);
  }

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const isPublic = this.reflector.getAllAndOverride<boolean | undefined>(IS_PUBLIC, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (isPublic === true) return true;

    const request = context.switchToHttp().getRequest<FastifyRequest>();
    const window = Math.floor(Date.now() / 1000 / WINDOW_SECONDS);
    const bucket = rateLimitBucket(request, this.trustedProxies);
    const who = bucket.kind === 'internal' ? 'internal' : `ip:${bucket.ip}`;
    const limit = bucket.kind === 'internal' ? this.internalLimit : this.limit;
    const key = `kp:v1:ratelimit:${context.getClass().name}:${who}:${String(window)}`;

    let count: number;
    try {
      const result = await this.cache
        .multi()
        .incr(key)
        .expire(key, WINDOW_SECONDS + 1)
        .exec();
      const incr = result?.[0];
      if (incr?.[0] !== null || typeof incr[1] !== 'number') {
        this.warnings.warn('unexpected', 'rate limit counter returned no value, allowing requests');
        return true;
      }
      count = incr[1];
    } catch (e) {
      this.warnings.warn(
        'unavailable',
        `rate limit unavailable, allowing requests: ${e instanceof Error ? e.message : 'error'}`,
      );
      return true;
    }

    if (count > limit) {
      const retryAfter = WINDOW_SECONDS - (Math.floor(Date.now() / 1000) % WINDOW_SECONDS);
      throw rateLimited(retryAfter);
    }
    return true;
  }
}
