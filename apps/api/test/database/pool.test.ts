import { describe, expect, it } from 'vitest';
import { loadEnv } from '../../src/config/env.js';
import { createPool } from '../../src/database/database.module.js';

const env = loadEnv({
  NODE_ENV: 'test',
  DATABASE_URL: 'postgres://app_rw:pw@127.0.0.1:1/kawanpasar',
  VALKEY_CACHE_URL: 'redis://:pw@127.0.0.1:1/0',
  VALKEY_QUEUE_URL: 'redis://:pw@127.0.0.1:1/0',
  SERVICE_TOKEN: 'x'.repeat(40),
});

describe('database pool', () => {
  it('survives an idle connection being dropped by the server (pool error event)', async () => {
    const pool = createPool(env);
    // Without a listener, EventEmitter throws on 'error' — in production that kills the process
    // whenever PgBouncer or PostgreSQL restarts.
    expect(() =>
      pool.emit('error', new Error('terminating connection due to administrator command')),
    ).not.toThrow();
    await pool.end();
  });

  it('is sized from the environment and fails connections fast', async () => {
    const pool = createPool({ ...env, DATABASE_POOL_MAX: 7 });
    expect(pool.options.max).toBe(7);
    expect(pool.options.connectionTimeoutMillis).toBe(2_000);
    await pool.end();
  });
});
