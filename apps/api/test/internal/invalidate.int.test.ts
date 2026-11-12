import type { NestFastifyApplication } from '@nestjs/platform-fastify';
import { Redis } from 'ioredis';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { serviceToken, startApp } from '../helpers/test-app.js';

let app: NestFastifyApplication;
// Offline queue on: the test client may be used before its first connection completes.
const redis = new Redis(process.env['VALKEY_CACHE_URL'] ?? '');

beforeAll(async () => {
  app = await startApp();
});

afterAll(async () => {
  await app.close();
  redis.disconnect();
});

const invalidate = (body: unknown, token: string | null = serviceToken()) =>
  app.inject({
    method: 'POST',
    url: '/internal/cache/invalidate',
    headers: token === null ? {} : { 'x-service-token': token },
    payload: body as Record<string, unknown>,
  });

describe('POST /internal/cache/invalidate', () => {
  it('requires the service token', async () => {
    expect((await invalidate({ scope: 'prices' }, null)).statusCode).toBe(401);
  });

  it('rejects an unknown scope by field name', async () => {
    const res = await invalidate({ scope: 'everything' });
    expect(res.statusCode).toBe(400);
    expect(res.json()).toEqual({
      error: { code: 'bad_request', message: 'invalid request', fields: ['scope'] },
    });
  });

  it('rejects unknown properties', async () => {
    expect((await invalidate({ scope: 'prices', extra: true })).statusCode).toBe(400);
  });

  it('deletes the scope and reports how many keys were removed', async () => {
    await invalidate({ scope: 'articles' });
    await redis.set('kp:v1:articles:list', '{}', 'EX', 60);
    const res = await invalidate({ scope: 'articles' });
    expect(res.statusCode).toBe(200);
    expect(res.json()).toEqual({ deleted: 1 });
  });
});
