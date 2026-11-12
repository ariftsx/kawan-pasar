import { createHash, timingSafeEqual } from 'node:crypto';
import { Inject, Injectable } from '@nestjs/common';
import type { CanActivate, ExecutionContext } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import type { FastifyRequest } from 'fastify';
import { ENV } from '../config/config.module.js';
import type { Env } from '../config/env.js';
import { unauthorized } from './api-errors.js';
import { IS_PUBLIC } from './public.decorator.js';

const digest = (value: string): Buffer => createHash('sha256').update(value).digest();

/**
 * Only internal callers (the Next.js BFF, jobs) may use the API. Tokens are compared as SHA-256
 * digests with timingSafeEqual, so neither the length nor the content leaks through timing.
 */
@Injectable()
export class ServiceTokenGuard implements CanActivate {
  private readonly expected: Buffer;

  constructor(
    @Inject(ENV) env: Env,
    private readonly reflector: Reflector,
  ) {
    this.expected = digest(env.SERVICE_TOKEN);
  }

  canActivate(context: ExecutionContext): boolean {
    const isPublic = this.reflector.getAllAndOverride<boolean | undefined>(IS_PUBLIC, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (isPublic === true) return true;

    const header = context.switchToHttp().getRequest<FastifyRequest>().headers['x-service-token'];
    const presented = typeof header === 'string' ? header : '';
    if (!timingSafeEqual(digest(presented), this.expected)) throw unauthorized();
    return true;
  }
}
