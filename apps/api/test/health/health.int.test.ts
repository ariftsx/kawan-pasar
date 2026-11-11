import type { NestFastifyApplication } from '@nestjs/platform-fastify';
import { afterEach, describe, expect, it } from 'vitest';
import { createApp } from '../../src/app.factory.js';
import { loadEnv } from '../../src/config/env.js';
import type { Env } from '../../src/config/env.js';

function testEnv(overrides: Record<string, string> = {}): Env {
  return loadEnv({
    NODE_ENV: 'test',
    LOG_LEVEL: 'silent',
    DATABASE_URL: process.env['TEST_DATABASE_URL'] ?? '',
    VALKEY_CACHE_URL: process.env['VALKEY_CACHE_URL'] ?? '',
    VALKEY_QUEUE_URL: process.env['VALKEY_QUEUE_URL'] ?? '',
    SERVICE_TOKEN: process.env['SERVICE_TOKEN'] ?? '',
    ...overrides,
  });
}

let app: NestFastifyApplication | undefined;

async function start(env: Env): Promise<NestFastifyApplication> {
  const created = await createApp(env);
  app = created;
  await created.init();
  await created.getHttpAdapter().getInstance().ready();
  return created;
}

afterEach(async () => {
  await app?.close();
  app = undefined;
});

describe('health endpoints', () => {
  it('reports liveness without touching dependencies', async () => {
    const res = await (await start(testEnv())).inject({ method: 'GET', url: '/health/live' });
    expect(res.statusCode).toBe(200);
    expect(res.json()).toEqual({ status: 'ok' });
  });

  it('reports ready when the database and cache are up', async () => {
    const res = await (await start(testEnv())).inject({ method: 'GET', url: '/health/ready' });
    expect(res.statusCode).toBe(200);
    expect(res.json()).toEqual({ status: 'ok', checks: { database: 'up', cache: 'up' } });
  });

  it('reports 503 with the failing check when the cache is unreachable', async () => {
    const env = testEnv({ VALKEY_CACHE_URL: 'redis://:pw@127.0.0.1:1/0' });
    const res = await (await start(env)).inject({ method: 'GET', url: '/health/ready' });
    expect(res.statusCode).toBe(503);
    expect(res.json()).toEqual({ status: 'error', checks: { database: 'up', cache: 'down' } });
  });

  it('does not advertise the server technology and sets security headers', async () => {
    const res = await (await start(testEnv())).inject({ method: 'GET', url: '/health/live' });
    expect(res.headers['x-powered-by']).toBeUndefined();
    expect(res.headers['x-content-type-options']).toBe('nosniff');
    expect(res.headers['x-request-id']).toMatch(/^[0-9a-f-]{36}$/);
  });

  it('sends a locked-down CSP suitable for a JSON-only API', async () => {
    const res = await (await start(testEnv())).inject({ method: 'GET', url: '/health/live' });
    expect(res.headers['content-security-policy']).toBe(
      "default-src 'none';base-uri 'none';form-action 'none';frame-ancestors 'none'",
    );
  });

  it('answers unknown routes with a generic 404 body', async () => {
    const res = await (await start(testEnv())).inject({ method: 'GET', url: '/nope' });
    expect(res.statusCode).toBe(404);
    expect(res.body).not.toMatch(/stack|node_modules|at /);
  });
});
