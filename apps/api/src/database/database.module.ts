import { Global, Inject, Logger, Module } from '@nestjs/common';
import type { OnApplicationShutdown } from '@nestjs/common';
import pg from 'pg';
import { ENV } from '../config/config.module.js';
import type { Env } from '../config/env.js';
import { createDb } from './client.js';

export const PG_POOL = Symbol('PG_POOL');
export const DRIZZLE = Symbol('DRIZZLE');

/**
 * Creates the application pool. The 'error' listener is mandatory: when PgBouncer or PostgreSQL
 * drops an idle connection, pg emits 'error' on the pool, and an unhandled 'error' event would
 * crash the whole process. The pool discards the broken client and reconnects on next use.
 */
export function createPool(env: Env): pg.Pool {
  const pool = new pg.Pool({
    connectionString: env.DATABASE_URL,
    max: env.DATABASE_POOL_MAX,
    idleTimeoutMillis: 30_000,
    connectionTimeoutMillis: 2_000,
    application_name: 'kawan-pasar-api',
  });
  const log = new Logger('DatabasePool');
  pool.on('error', (e: Error) => {
    log.warn(`idle database connection lost: ${e.message}`);
  });
  return pool;
}

@Global()
@Module({
  providers: [
    {
      provide: PG_POOL,
      inject: [ENV],
      useFactory: createPool,
    },
    { provide: DRIZZLE, inject: [PG_POOL], useFactory: createDb },
  ],
  exports: [PG_POOL, DRIZZLE],
})
export class DatabaseModule implements OnApplicationShutdown {
  constructor(@Inject(PG_POOL) private readonly pool: pg.Pool) {}

  async onApplicationShutdown(): Promise<void> {
    await this.pool.end();
  }
}
