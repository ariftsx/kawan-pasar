import { Global, Inject, Logger, Module } from '@nestjs/common';
import type { OnApplicationShutdown, OnModuleInit } from '@nestjs/common';
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
export class DatabaseModule implements OnModuleInit, OnApplicationShutdown {
  private readonly log = new Logger('DatabaseModule');

  constructor(@Inject(PG_POOL) private readonly pool: pg.Pool) {}

  /**
   * Opens the first connection during boot. Through PgBouncer (SCRAM + auth_query) the first
   * connection can take longer than the readiness probe allows, which made /health/ready report
   * "down" right after start. Never throws: an unreachable database is reported by readiness.
   */
  async onModuleInit(): Promise<void> {
    try {
      await this.pool.query('SELECT 1');
    } catch (e) {
      this.log.warn(
        `database not reachable at startup: ${e instanceof Error ? e.message : 'error'}`,
      );
    }
  }

  async onApplicationShutdown(): Promise<void> {
    await this.pool.end();
  }
}
