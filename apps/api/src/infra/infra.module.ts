import { Global, Inject, Module, type OnApplicationShutdown } from '@nestjs/common';

import { createSql, createValkey, SQL, VALKEY_CACHE, VALKEY_QUEUE, type Sql } from './clients.js';
import { ENV } from '../config/config.module.js';

import type { Env } from '../config/env.js';
import type { Redis } from 'ioredis';

@Global()
@Module({
  providers: [
    { provide: SQL, inject: [ENV], useFactory: (env: Env) => createSql(env) },
    {
      provide: VALKEY_CACHE,
      inject: [ENV],
      useFactory: (env: Env) => createValkey(env.VALKEY_CACHE_URL),
    },
    {
      provide: VALKEY_QUEUE,
      inject: [ENV],
      useFactory: (env: Env) => createValkey(env.VALKEY_QUEUE_URL),
    },
  ],
  exports: [SQL, VALKEY_CACHE, VALKEY_QUEUE],
})
export class InfraModule implements OnApplicationShutdown {
  constructor(
    @Inject(SQL) private readonly sql: Sql,
    @Inject(VALKEY_CACHE) private readonly cache: Redis,
    @Inject(VALKEY_QUEUE) private readonly queue: Redis,
  ) {}

  /** Drains connections on SIGTERM so rolling updates do not cut queries (docs 13 §A3). */
  async onApplicationShutdown(): Promise<void> {
    this.cache.disconnect();
    this.queue.disconnect();
    await this.sql.end({ timeout: 5 });
  }
}
