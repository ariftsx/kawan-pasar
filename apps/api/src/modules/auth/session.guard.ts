import { createHash, timingSafeEqual } from 'node:crypto';
import { TokenSchema } from '@kawan-pasar/contracts';
import { createParamDecorator, Inject, Injectable } from '@nestjs/common';
import type { CanActivate, ExecutionContext } from '@nestjs/common';
import type { FastifyRequest } from 'fastify';
import { csrfRejected, unauthenticated } from '../../common/api-errors.js';
import { clientIp } from '../../common/client-ip.js';
import type { AuthContext, Caller } from './auth.service.js';
import { SESSION_STORE } from './tokens.js';
import type { SessionStore } from './session.store.js';

const contexts = new WeakMap<FastifyRequest, AuthContext>();

const header = (request: FastifyRequest, name: string): string => {
  const value = request.headers[name];
  return typeof value === 'string' ? value : '';
};

/** Requires a live session in `x-session-token` (the BFF forwards the cookie value). */
@Injectable()
export class SessionGuard implements CanActivate {
  constructor(@Inject(SESSION_STORE) private readonly sessions: SessionStore) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<FastifyRequest>();
    const token = header(request, 'x-session-token');
    if (!TokenSchema.safeParse(token).success) throw unauthenticated();
    const session = await this.sessions.read(token);
    if (session === null) throw unauthenticated();
    contexts.set(request, { token, session });
    return true;
  }
}

const digest = (value: string): Buffer => createHash('sha256').update(value).digest();

/**
 * State-changing requests must carry the session's CSRF secret in `x-csrf-token` (rendered into
 * the account forms by the BFF). Compared as digests in constant time. Runs after SessionGuard.
 */
@Injectable()
export class CsrfGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest<FastifyRequest>();
    if (request.method === 'GET' || request.method === 'HEAD') return true;
    const auth = contexts.get(request);
    if (auth === undefined) throw unauthenticated();
    if (!timingSafeEqual(digest(header(request, 'x-csrf-token')), digest(auth.session.csrf))) {
      throw csrfRejected();
    }
    return true;
  }
}

/** The authenticated session of the request (only on routes guarded by SessionGuard). */
export const Auth = createParamDecorator((_data: unknown, ctx: ExecutionContext): AuthContext => {
  const auth = contexts.get(ctx.switchToHttp().getRequest<FastifyRequest>());
  if (auth === undefined) throw unauthenticated();
  return auth;
});

/** The visitor's address (resolved through the trusted proxy list) and browser. */
export const CallerInfo = createParamDecorator((_data: unknown, ctx: ExecutionContext): Caller => {
  const request = ctx.switchToHttp().getRequest<FastifyRequest>();
  return { ip: clientIp(request), userAgent: header(request, 'user-agent').slice(0, 400) };
});

/** The session of a request already passed through SessionGuard (for other guards), or null. */
export function sessionOf(request: FastifyRequest): AuthContext | null {
  return contexts.get(request) ?? null;
}
