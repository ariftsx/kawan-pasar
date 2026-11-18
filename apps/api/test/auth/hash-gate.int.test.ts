import type { NestFastifyApplication } from '@nestjs/platform-fastify';
import { Redis } from 'ioredis';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { resetTestDatabase } from '../helpers/test-db.js';
import { serviceToken, startApp, testEnv } from '../helpers/test-app.js';

let app: NestFastifyApplication;

beforeAll(async () => {
  await resetTestDatabase();
  const env = testEnv({
    TRUSTED_PROXY_IPS: '127.0.0.1',
    AUTH_HASH_CONCURRENCY: '1',
    AUTH_HASH_QUEUE: '0',
  });
  const sessions = new Redis(env.VALKEY_SESSION_URL);
  await sessions.flushdb();
  sessions.disconnect();
  app = await startApp({ env });
});

afterAll(async () => {
  await app.close();
});

describe('sign-in under a flood', () => {
  it('refuses attempts beyond the hashing capacity with 429, never 500, and does not lock', async () => {
    const attempts = await Promise.all(
      Array.from({ length: 6 }, (_, i) =>
        app.inject({
          method: 'POST',
          url: '/v1/auth/login',
          headers: { 'x-service-token': serviceToken(), 'x-forwarded-for': `10.5.0.${String(i)}` },
          payload: { email: 'banjir@contoh.id', password: 'tebakan yang salah sekali' },
        }),
      ),
    );
    const statuses = attempts.map((r) => r.statusCode);
    expect(statuses.every((s) => s === 401 || s === 429)).toBe(true);
    const busy = attempts.filter((r) => r.statusCode === 429);
    expect(busy.length).toBeGreaterThan(0);
    expect(busy[0]?.json()).toMatchObject({ error: { code: 'rate_limited' } });
    expect(busy[0]?.headers['retry-after']).toBe('1');
  });
});
