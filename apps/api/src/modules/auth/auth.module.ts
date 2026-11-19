import { Inject, Logger, Module } from '@nestjs/common';
import type { OnApplicationShutdown } from '@nestjs/common';
import { Redis } from 'ioredis';
import { CLOCK } from '../../common/clock.js';
import type { Clock } from '../../common/clock.js';
import { ENV } from '../../config/config.module.js';
import type { Env } from '../../config/env.js';
import type { Db } from '../../database/client.js';
import { DRIZZLE } from '../../database/database.module.js';
import { MAIL_OUTBOX, MailQueueModule } from '../mail/mail.queue.js';
import type { MailOutbox } from '../mail/mail.queue.js';
import { AccountController } from './account.controller.js';
import { AuthController } from './auth.controller.js';
import { AuthRateLimiter } from './auth-rate-limiter.js';
import { AuthService } from './auth.service.js';
import { AuthTokenService } from './auth-token.service.js';
import { BreachedPasswords } from './breached-passwords.js';
import { HashGate } from './hash-gate.js';
import { LockoutService } from './lockout.service.js';
import { PasswordService } from './password.service.js';
import { SESSION } from './policy.js';
import { CsrfGuard, SessionGuard } from './session.guard.js';
import { SessionStore } from './session.store.js';
import { AUTH_SERVICE, SESSION_REDIS, SESSION_STORE } from './tokens.js';
import { PhoneCipher } from './phone-cipher.js';
import { UsersRepository } from './users.repository.js';

@Module({
  imports: [MailQueueModule],
  controllers: [AuthController, AccountController],
  // The alerts module guards its routes with the same session and CSRF checks.
  exports: [SESSION_STORE, SessionGuard, CsrfGuard],
  providers: [
    {
      provide: SESSION_REDIS,
      inject: [ENV],
      useFactory: (env: Env): Redis => {
        // Commands wait for a reconnect only briefly: no session store means no sign-in (503).
        const client = new Redis(env.VALKEY_SESSION_URL, {
          maxRetriesPerRequest: 1,
          connectTimeout: 2_000,
          commandTimeout: 1_000,
        });
        const log = new Logger('SessionStore');
        client.on('error', (e: Error) => {
          log.warn(`session store connection error: ${e.message}`);
        });
        return client;
      },
    },
    {
      provide: SESSION_STORE,
      inject: [SESSION_REDIS, CLOCK],
      useFactory: (redis: Redis, clock: Clock) => new SessionStore(redis, clock, SESSION),
    },
    {
      provide: AUTH_SERVICE,
      inject: [ENV, DRIZZLE, SESSION_REDIS, SESSION_STORE, MAIL_OUTBOX, CLOCK],
      useFactory: (
        env: Env,
        db: Db,
        redis: Redis,
        sessions: SessionStore,
        outbox: MailOutbox,
        clock: Clock,
      ) =>
        new AuthService({
          users: new UsersRepository(db, env.AUTH_SECRET, new PhoneCipher(env.PHONE_ENC_KEY)),
          passwords: new PasswordService(
            BreachedPasswords.bundled(),
            new HashGate({
              concurrency: env.AUTH_HASH_CONCURRENCY,
              maxQueue: env.AUTH_HASH_QUEUE,
              maxWaitMs: 2_000,
            }),
          ),
          sessions,
          lockout: new LockoutService(redis, env.AUTH_SECRET),
          tokens: new AuthTokenService(db, clock),
          limiter: new AuthRateLimiter(redis, env.AUTH_SECRET, clock),
          outbox,
          clock,
        }),
    },
    SessionGuard,
    CsrfGuard,
  ],
})
export class AuthModule implements OnApplicationShutdown {
  constructor(@Inject(SESSION_REDIS) private readonly redis: Redis) {}

  onApplicationShutdown(): void {
    this.redis.disconnect();
  }
}
