// Only the BFF may call the API (docs 13 §A3, docs 14 §5 guard order: this guard runs first).
import { createHash, timingSafeEqual } from 'node:crypto';

import {
  Inject,
  Injectable,
  SetMetadata,
  type CanActivate,
  type ExecutionContext,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';

import { AppError } from './app-error.js';
import { ENV } from '../config/config.module.js';

import type { Env } from '../config/env.js';
import type { FastifyRequest } from 'fastify';

export const SERVICE_TOKEN_HEADER = 'x-service-token';

const IS_PROBE = Symbol('IS_PROBE');

/** Marks a route reachable without the service token: orchestrator probes only. */
export const Probe = () => SetMetadata(IS_PROBE, true);

/** Hashing first gives equal-length buffers, so the comparison time never depends on the input. */
function digest(value: string): Buffer {
  return createHash('sha256').update(value).digest();
}

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
    const isProbe = this.reflector.getAllAndOverride<boolean | undefined>(IS_PROBE, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (isProbe === true) return true;

    const header = context.switchToHttp().getRequest<FastifyRequest>().headers['x-service-token'];
    if (typeof header === 'string' && timingSafeEqual(digest(header), this.expected)) return true;
    throw new AppError('UNAUTHENTICATED', 'Token layanan tidak valid.');
  }
}
