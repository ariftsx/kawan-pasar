import { Inject, Injectable, SetMetadata } from '@nestjs/common';
import type { CanActivate, ExecutionContext } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import type { FastifyRequest } from 'fastify';
import { forbidden, reauthRequired, unauthenticated } from '../../common/api-errors.js';
import type { SessionStore } from '../auth/session.store.js';
import { sessionOf } from '../auth/session.guard.js';
import { SESSION_STORE } from '../auth/tokens.js';
import type { UsersRepository } from '../auth/users.repository.js';
import type { AdminSessions } from './admin-session.js';

export const ADMIN_USERS = Symbol('ADMIN_USERS');
export const ADMIN_SESSIONS = Symbol('ADMIN_SESSIONS');

const NEEDS_CONFIRMATION = 'kp:admin:confirm';

/** Marks an admin action that changes data: it needs the password confirmed in the last 10 minutes. */
export const RequiresConfirmation = (): MethodDecorator & ClassDecorator =>
  SetMetadata(NEEDS_CONFIRMATION, true);

/**
 * Admin routes (Fase 3B). Runs after SessionGuard (and CsrfGuard). The role is read from the
 * database on every request; an expired admin session ends the whole session (sign in again).
 */
@Injectable()
export class AdminGuard implements CanActivate {
  constructor(
    @Inject(ADMIN_USERS) private readonly users: UsersRepository,
    @Inject(ADMIN_SESSIONS) private readonly admin: AdminSessions,
    @Inject(SESSION_STORE) private readonly sessions: SessionStore,
    @Inject(Reflector) private readonly reflector: Reflector,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const auth = sessionOf(context.switchToHttp().getRequest<FastifyRequest>());
    if (auth === null) throw unauthenticated();
    const user = await this.users.findById(auth.session.userId);
    if (user === null) throw unauthenticated();
    if (user.role !== 'admin') throw forbidden();
    const signedInAt = new Date(auth.session.createdAt);
    if ((await this.admin.touch(auth.session.id, signedInAt)) === 'expired') {
      await this.admin.end(auth.session.id);
      await this.sessions.revoke(auth.token);
      throw unauthenticated();
    }
    const needsConfirmation = this.reflector.getAllAndOverride<boolean | undefined>(
      NEEDS_CONFIRMATION,
      [context.getHandler(), context.getClass()],
    );
    if (needsConfirmation === true && (await this.admin.confirmedUntil(auth.session.id)) === null) {
      throw reauthRequired();
    }
    return true;
  }
}
