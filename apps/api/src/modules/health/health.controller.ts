import { Controller, Get, Header, Inject, Res } from '@nestjs/common';

import { assessReadiness, type DependencyCheck, type ReadinessReport } from './readiness.js';
import { Probe } from '../../common/service-token.guard.js';
import { ENV } from '../../config/config.module.js';
import { pingValkey, SQL, VALKEY_CACHE, VALKEY_QUEUE, type Sql } from '../../infra/clients.js';

import type { Env } from '../../config/env.js';
import type { FastifyReply } from 'fastify';
import type { Redis } from 'ioredis';

/** Probes for Docker, Traefik, and Uptime Kuma (docs 13 §A9). */
@Controller()
@Probe()
export class HealthController {
  private readonly checks: readonly DependencyCheck[];

  constructor(
    @Inject(ENV) env: Env,
    @Inject(SQL) sql: Sql,
    @Inject(VALKEY_CACHE) cache: Redis,
    @Inject(VALKEY_QUEUE) queue: Redis,
  ) {
    const modelReady = new URL('/readyz', env.MODEL_URL);
    this.checks = [
      { name: 'postgres', critical: true, run: () => sql`select 1` },
      { name: 'valkey_cache', critical: false, run: () => pingValkey(cache) },
      { name: 'valkey_queue', critical: false, run: () => pingValkey(queue) },
      {
        name: 'model',
        critical: false,
        run: async (signal) => {
          const response = await fetch(modelReady, { signal });
          if (!response.ok) throw new Error(`model readyz ${String(response.status)}`);
        },
      },
    ];
  }

  @Get('healthz')
  @Header('cache-control', 'no-store')
  liveness(): { status: 'ok' } {
    return { status: 'ok' };
  }

  /** 503 only when a critical dependency is down; `degraded` keeps the replica in rotation. */
  @Get('readyz')
  @Header('cache-control', 'no-store')
  async readiness(@Res({ passthrough: true }) reply: FastifyReply): Promise<ReadinessReport> {
    const report = await assessReadiness(this.checks);
    if (report.status === 'down') void reply.status(503);
    return report;
  }
}
