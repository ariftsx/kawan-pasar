import { Inject, Module } from '@nestjs/common';
import type { OnApplicationShutdown } from '@nestjs/common';
import type { Redis } from 'ioredis';
import { CLOCK } from '../../common/clock.js';
import type { Clock } from '../../common/clock.js';
import { ENV } from '../../config/config.module.js';
import type { Env } from '../../config/env.js';
import type { Db } from '../../database/client.js';
import { DRIZZLE } from '../../database/database.module.js';
import { AuthModule } from '../auth/auth.module.js';
import { InternalModule } from '../internal/internal.module.js';
import { MailQueueModule } from '../mail/mail.queue.js';
import { ADMIN_ARTICLES, AdminArticlesController } from './admin-articles.controller.js';
import { AdminArticlesRepository } from './admin-articles.repository.js';
import { phoneCipherFromEnv } from '../auth/phone-cipher.js';
import { SESSION_REDIS } from '../auth/tokens.js';
import { UsersRepository, undecryptablePhone } from '../auth/users.repository.js';
import { AdminSessions } from './admin-session.js';
import { ADMIN_QUEUE_STATS, ADMIN_REPOSITORY, AdminController } from './admin.controller.js';
import { ADMIN_SESSIONS, ADMIN_USERS, AdminGuard } from './admin.guard.js';
import { AdminRepository } from './admin.repository.js';
import {
  AdminModelCandidatesController,
  MODEL_CANDIDATES,
  ModelCandidatesInternalController,
  ModelCandidatesRepository,
} from './model-candidates.js';
import { QueueStats } from './queue-stats.js';
import { AdminModelAuditController, PIPELINE_RUNS_DIR } from './model-audit.js';
import {
  AIRFLOW_CLIENT,
  AdminPipelineController,
  PIPELINE_REPOSITORY,
  PipelineInternalController,
  PipelineRepository,
} from './pipeline.js';
import { AirflowClient } from '../pipeline/airflow-client.js';

@Module({
  imports: [AuthModule, MailQueueModule, InternalModule],
  controllers: [
    AdminController,
    AdminArticlesController,
    AdminModelCandidatesController,
    ModelCandidatesInternalController,
    AdminModelAuditController,
    AdminPipelineController,
    PipelineInternalController,
  ],
  providers: [
    {
      provide: ADMIN_USERS,
      inject: [ENV, DRIZZLE],
      useFactory: (env: Env, db: Db): UsersRepository =>
        new UsersRepository(db, env.AUTH_SECRET, phoneCipherFromEnv(env), undecryptablePhone),
    },
    {
      provide: ADMIN_SESSIONS,
      inject: [SESSION_REDIS, CLOCK],
      useFactory: (redis: Redis, clock: Clock): AdminSessions => new AdminSessions(redis, clock),
    },
    {
      provide: ADMIN_REPOSITORY,
      inject: [DRIZZLE],
      useFactory: (db: Db): AdminRepository => new AdminRepository(db),
    },
    {
      provide: ADMIN_QUEUE_STATS,
      inject: [ENV],
      useFactory: (env: Env): QueueStats => new QueueStats(env.VALKEY_QUEUE_URL),
    },
    {
      provide: ADMIN_ARTICLES,
      inject: [DRIZZLE],
      useFactory: (db: Db): AdminArticlesRepository => new AdminArticlesRepository(db),
    },
    {
      provide: MODEL_CANDIDATES,
      inject: [DRIZZLE],
      useFactory: (db: Db): ModelCandidatesRepository => new ModelCandidatesRepository(db),
    },
    {
      provide: PIPELINE_REPOSITORY,
      inject: [DRIZZLE],
      useFactory: (db: Db): PipelineRepository => new PipelineRepository(db),
    },
    {
      // Fase 4C: Airflow REST API on the backend network; unset → pages say "Airflow tidak aktif".
      provide: AIRFLOW_CLIENT,
      inject: [ENV],
      useFactory: (env: Env): AirflowClient =>
        new AirflowClient(
          env.AIRFLOW_API_URL === undefined || env.AIRFLOW_API_PASSWORD === undefined
            ? null
            : { url: env.AIRFLOW_API_URL, password: env.AIRFLOW_API_PASSWORD },
        ),
    },
    {
      provide: PIPELINE_RUNS_DIR,
      inject: [ENV],
      useFactory: (env: Env): string | null => env.PIPELINE_RUNS_DIR ?? null,
    },
    AdminGuard,
  ],
})
export class AdminModule implements OnApplicationShutdown {
  constructor(@Inject(ADMIN_QUEUE_STATS) private readonly queues: QueueStats) {}

  async onApplicationShutdown(): Promise<void> {
    await this.queues.close();
  }
}
