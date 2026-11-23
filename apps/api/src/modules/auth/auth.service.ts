import type {
  ChangePasswordInput,
  DeleteAccountInput,
  LoginInput,
  LoginResponse,
  MeResponse,
  RegisterInput,
  ResetInput,
  SessionsResponse,
} from '@kawan-pasar/contracts';
import { TokenSchema, maskPhone } from '@kawan-pasar/contracts';
import type { Clock } from '../../common/clock.js';
import {
  invalidCredentials,
  invalidToken,
  locked,
  unauthenticated,
  weakPassword,
} from '../../common/api-errors.js';
import type { MailOutbox } from '../mail/mail.queue.js';
import type { AuthRateLimiter } from './auth-rate-limiter.js';
import { AUTH_LIMITS } from './auth-rate-limiter.js';
import type { AuthTokenService } from './auth-token.service.js';
import type { LockoutService } from './lockout.service.js';
import type { PasswordService } from './password.service.js';
import { SESSION } from './policy.js';
import { deviceOf } from './session.store.js';
import type { Session, SessionStore } from './session.store.js';
import type { UsersRepository } from './users.repository.js';

/** Who is asking: the visitor's address (from the trusted BFF) and browser. */
export interface Caller {
  ip: string;
  userAgent: string;
}

/** The authenticated session of a request (set by SessionGuard). */
const WIB_DATE_TIME = new Intl.DateTimeFormat('id-ID', {
  timeZone: 'Asia/Jakarta',
  day: 'numeric',
  month: 'long',
  year: 'numeric',
  hour: '2-digit',
  minute: '2-digit',
});

export interface AuthContext {
  token: string;
  session: Session;
}

export interface AuthDeps {
  users: UsersRepository;
  passwords: PasswordService;
  sessions: SessionStore;
  lockout: LockoutService;
  tokens: AuthTokenService;
  limiter: AuthRateLimiter;
  outbox: MailOutbox;
  clock: Clock;
}

/**
 * Account flows (design Fase 2 §3). Answers that could reveal whether an address has an account
 * (register, forgot password, resend) are identical in body, status and roughly in time.
 */
export class AuthService {
  constructor(private readonly d: AuthDeps) {}

  async register(input: RegisterInput, caller: Caller): Promise<void> {
    // Policy first: the answer must not depend on whether the address exists.
    const problem = this.d.passwords.policyProblem(input.password, input.email);
    if (problem !== null) throw weakPassword(problem);
    await this.d.limiter.hit('register:ip', caller.ip, AUTH_LIMITS.emailAction);
    await this.d.limiter.hit('register:email', input.email, AUTH_LIMITS.emailAction);

    // Hashing runs on both paths, so a known address costs the same time as a new one.
    const hash = await this.d.passwords.hash(input.password);
    const existing = await this.d.users.findByEmail(input.email);
    // A sign-up for a known address changes nothing about that account, its number included.
    const id = existing === null ? await this.d.users.create(input.email, hash, input.phone) : null;
    if (id === null) {
      const owner = existing ?? (await this.d.users.findByEmail(input.email));
      await this.d.outbox.send({ template: 'already_registered', to: owner?.email ?? input.email });
      return;
    }
    const token = await this.d.tokens.issue(id, 'verify_email');
    await this.d.outbox.send({ template: 'verify_email', to: input.email, token });
    await this.d.users.recordEvent(id, 'register', caller.ip, this.d.clock.now());
  }

  async login(input: LoginInput, caller: Caller, previousToken?: string): Promise<LoginResponse> {
    await this.d.limiter.hit('login:ip', caller.ip, AUTH_LIMITS.login);
    const lock = await this.d.lockout.check(input.email);
    if (lock.locked) throw locked(lock.retryAfter);

    const user = await this.d.users.findByEmail(input.email);
    const result =
      user === null
        ? await this.d.passwords.verifyDummy(input.password)
        : await this.d.passwords.verify(user.passwordHash, input.password);
    const now = this.d.clock.now();
    if (user === null || !result.ok) {
      await this.d.lockout.fail(input.email);
      await this.d.users.recordEvent(user?.id ?? null, 'login_fail', caller.ip, now);
      throw invalidCredentials();
    }
    await this.d.lockout.reset(input.email);
    if (result.needsRehash) {
      await this.d.users.setPassword(user.id, await this.d.passwords.hash(input.password), now);
    }
    if (previousToken !== undefined && TokenSchema.safeParse(previousToken).success) {
      await this.d.sessions.revoke(previousToken);
    }
    const { token, csrf } = await this.d.sessions.create(user.id, caller.userAgent);
    await this.d.users.recordEvent(user.id, 'login_ok', caller.ip, now);
    if (user.role === 'admin') {
      // Fase 3B (design § 1, P2 without 2FA): every admin sign-in is announced to the owner.
      await this.d.outbox.send({
        template: 'admin_sign_in',
        to: user.email,
        lines: [
          deviceOf(caller.userAgent),
          WIB_DATE_TIME.format(now).replace(/\s*pukul\s*/, ' ') + ' WIB',
        ],
      });
    }
    return {
      token,
      csrf,
      expiresAt: new Date(now.getTime() + SESSION.absoluteSeconds * 1000).toISOString(),
    };
  }

  async logout(auth: AuthContext, caller: Caller): Promise<void> {
    await this.d.sessions.revoke(auth.token);
    await this.d.users.recordEvent(auth.session.userId, 'logout', caller.ip, this.d.clock.now());
  }

  async verifyEmail(token: string, caller: Caller): Promise<void> {
    const userId = await this.d.tokens.consume(token, 'verify_email');
    if (userId === null) throw invalidToken();
    const now = this.d.clock.now();
    await this.d.users.markVerified(userId, now);
    await this.d.users.recordEvent(userId, 'verify', caller.ip, now);
  }

  async resendVerification(auth: AuthContext): Promise<void> {
    await this.d.limiter.hit('resend:user', auth.session.userId, AUTH_LIMITS.emailAction);
    const user = await this.d.users.findById(auth.session.userId);
    if (user?.emailVerifiedAt !== null) {
      await this.d.outbox.send({ template: 'noop' });
      return;
    }
    const token = await this.d.tokens.issue(user.id, 'verify_email');
    await this.d.outbox.send({ template: 'verify_email', to: user.email, token });
  }

  async forgotPassword(email: string, caller: Caller): Promise<void> {
    await this.d.limiter.hit('forgot:ip', caller.ip, AUTH_LIMITS.emailAction);
    await this.d.limiter.hit('forgot:email', email, AUTH_LIMITS.emailAction);
    // Same single step for every address (no lookup here): the worker resolves the request.
    // Any difference in work would let response times tell registered addresses apart.
    await this.d.outbox.send({ template: 'forgot_password', to: email, ip: caller.ip });
  }

  async resetPassword(input: ResetInput, caller: Caller): Promise<void> {
    // Check the new password before using the token: a refused password keeps the link valid.
    const holder = await this.d.tokens.peek(input.token, 'reset_password');
    const user = holder === null ? null : await this.d.users.findById(holder);
    if (user === null) throw invalidToken();
    const problem = this.d.passwords.policyProblem(input.password, user.email);
    if (problem !== null) throw weakPassword(problem);
    const hash = await this.d.passwords.hash(input.password);
    if ((await this.d.tokens.consume(input.token, 'reset_password')) !== user.id) {
      throw invalidToken();
    }
    const now = this.d.clock.now();
    await this.d.users.setPassword(user.id, hash, now);
    await this.d.sessions.revokeAll(user.id);
    await this.d.lockout.reset(user.email);
    await this.d.outbox.send({ template: 'password_changed', to: user.email });
    await this.d.users.recordEvent(user.id, 'reset_done', caller.ip, now);
  }

  async me(auth: AuthContext): Promise<MeResponse> {
    const user = await this.requireUser(auth);
    return {
      id: user.id,
      email: user.email,
      emailVerified: user.emailVerifiedAt !== null,
      createdAt: user.createdAt.toISOString(),
      phone: user.phone === null ? null : maskPhone(user.phone),
      csrf: auth.session.csrf,
    };
  }

  async changePassword(
    auth: AuthContext,
    input: ChangePasswordInput,
    caller: Caller,
  ): Promise<void> {
    const user = await this.requireUser(auth);
    await this.confirmPassword(user.email, user.passwordHash, input.current, caller);
    const problem = this.d.passwords.policyProblem(input.next, user.email);
    if (problem !== null) throw weakPassword(problem, 'next');
    const now = this.d.clock.now();
    await this.d.users.setPassword(user.id, await this.d.passwords.hash(input.next), now);
    await this.d.sessions.revokeAll(user.id, auth.token);
    await this.d.outbox.send({ template: 'password_changed', to: user.email });
    await this.d.users.recordEvent(user.id, 'password_change', caller.ip, now);
  }

  /** Sets, replaces or (null) removes the optional mobile number. Not verified here (Fase 2C). */
  async setPhone(auth: AuthContext, phone: string | null, caller: Caller): Promise<void> {
    const user = await this.requireUser(auth);
    await this.d.users.setPhone(user.id, phone);
    await this.d.users.recordEvent(user.id, 'phone_change', caller.ip, this.d.clock.now());
  }

  async listSessions(auth: AuthContext): Promise<SessionsResponse> {
    return { items: await this.d.sessions.list(auth.session.userId, auth.token) };
  }

  /** False when the session is not this user's (answered as 404 by the controller). */
  async revokeSession(auth: AuthContext, id: string, caller: Caller): Promise<boolean> {
    const done = await this.d.sessions.revokeById(auth.session.userId, id);
    if (done) {
      await this.d.users.recordEvent(
        auth.session.userId,
        'session_revoke',
        caller.ip,
        this.d.clock.now(),
      );
    }
    return done;
  }

  async deleteAccount(auth: AuthContext, input: DeleteAccountInput, caller: Caller): Promise<void> {
    const user = await this.requireUser(auth);
    await this.confirmPassword(user.email, user.passwordHash, input.password, caller);
    await this.d.users.delete(user.id);
    await this.d.sessions.revokeAll(user.id);
    await this.d.outbox.send({ template: 'account_deleted', to: user.email });
    // Recorded after deletion: the audit trail keeps the event, not the person.
    await this.d.users.recordEvent(null, 'account_delete', caller.ip, this.d.clock.now());
  }

  /** Admin password confirmation (Fase 3B): same checks and lockout as a sign-in. */
  async reauthenticate(auth: AuthContext, password: string, caller: Caller): Promise<void> {
    const user = await this.requireUser(auth);
    await this.confirmPassword(user.email, user.passwordHash, password, caller);
    await this.d.lockout.reset(user.email);
  }

  private async requireUser(
    auth: AuthContext,
  ): Promise<NonNullable<Awaited<ReturnType<UsersRepository['findById']>>>> {
    const user = await this.d.users.findById(auth.session.userId);
    if (user === null) {
      await this.d.sessions.revoke(auth.token);
      throw unauthenticated();
    }
    return user;
  }

  /** Re-entering the password counts toward the account lockout like a sign-in. */
  private async confirmPassword(
    email: string,
    hash: string,
    password: string,
    caller: Caller,
  ): Promise<void> {
    const lock = await this.d.lockout.check(email);
    if (lock.locked) throw locked(lock.retryAfter);
    if (!(await this.d.passwords.verify(hash, password)).ok) {
      await this.d.lockout.fail(email);
      await this.d.users.recordEvent(null, 'login_fail', caller.ip, this.d.clock.now());
      throw invalidCredentials();
    }
  }
}
