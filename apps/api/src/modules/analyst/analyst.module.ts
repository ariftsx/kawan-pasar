import { Module } from '@nestjs/common';
import type { Redis } from 'ioredis';
import { CLOCK } from '../../common/clock.js';
import type { Clock } from '../../common/clock.js';
import { ENV } from '../../config/config.module.js';
import type { Env } from '../../config/env.js';
import type { Db } from '../../database/client.js';
import { DRIZZLE } from '../../database/database.module.js';
import { AuthRateLimiter } from '../auth/auth-rate-limiter.js';
import { AuthModule } from '../auth/auth.module.js';
import { phoneCipherFromEnv } from '../auth/phone-cipher.js';
import { SESSION_REDIS } from '../auth/tokens.js';
import { UsersRepository, undecryptablePhone } from '../auth/users.repository.js';
import {
  ANALYST_SERVICE,
  ANALYST_USERS,
  AnalystController,
  AnalystExportController,
  AnalystRoleGuard,
} from './analyst.controller.js';
import { AnalystRepository } from './analyst.repository.js';
import { AnalystService } from './analyst.service.js';

@Module({
  imports: [AuthModule],
  controllers: [AnalystController, AnalystExportController],
  providers: [
    {
      provide: ANALYST_USERS,
      inject: [ENV, DRIZZLE],
      useFactory: (env: Env, db: Db): UsersRepository =>
        new UsersRepository(db, env.AUTH_SECRET, phoneCipherFromEnv(env), undecryptablePhone),
    },
    {
      provide: ANALYST_SERVICE,
      inject: [ENV, DRIZZLE, SESSION_REDIS, CLOCK, ANALYST_USERS],
      useFactory: (env: Env, db: Db, redis: Redis, clock: Clock, users: UsersRepository) =>
        new AnalystService(
          new AnalystRepository(db),
          users,
          new AuthRateLimiter(redis, env.AUTH_SECRET, clock),
        ),
    },
    AnalystRoleGuard,
  ],
})
export class AnalystModule {}
