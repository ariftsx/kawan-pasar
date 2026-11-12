import { createServer } from 'node:http';
import type { AddressInfo } from 'node:net';
import type { NestFastifyApplication } from '@nestjs/platform-fastify';
import { Redis } from 'ioredis';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { serviceToken, startApp, testEnv } from '../helpers/test-app.js';

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

describe('web revalidation after invalidation', () => {
  it('asks the web server to revalidate the matching tags', async () => {
    const received: { token: string | undefined; body: string }[] = [];
    const web = createServer((req, res) => {
      let body = '';
      req.on('data', (c: Buffer) => (body += c.toString()));
      req.on('end', () => {
        const token = req.headers['x-revalidate-token'];
        received.push({ token: typeof token === 'string' ? token : undefined, body });
        res.writeHead(204).end();
      });
    });
    await new Promise<void>((r) => web.listen(0, '127.0.0.1', r));
    const port = (web.address() as AddressInfo).port;
    const token = 'v'.repeat(40);
    const local = await startApp({
      env: testEnv({
        WEB_INTERNAL_URL: `http://127.0.0.1:${String(port)}`,
        WEB_REVALIDATE_TOKEN: token,
      }),
    });
    try {
      const res = await local.inject({
        method: 'POST',
        url: '/internal/cache/invalidate',
        headers: { 'x-service-token': serviceToken() },
        payload: { scope: 'forecasts' },
      });
      expect(res.statusCode).toBe(200);
      expect(received).toHaveLength(1);
      expect(received[0]?.token).toBe(token);
      const sent = JSON.parse(received[0]?.body ?? '{}') as { tags?: string[] };
      expect(sent.tags).toEqual(expect.arrayContaining(['forecast:PIKJ', 'prices:PIKJ']));
    } finally {
      await local.close();
      await new Promise<void>((r) =>
        web.close(() => {
          r();
        }),
      );
    }
  });
});
