import { randomUUID } from 'node:crypto';
import { Controller, Get, Module } from '@nestjs/common';
import type { NestFastifyApplication } from '@nestjs/platform-fastify';
import { afterEach, describe, expect, it } from 'vitest';
import { serviceToken, startApp, testEnv } from '../helpers/test-app.js';

@Controller('v1/limited')
class LimitedController {
  @Get()
  get(): { ok: true } {
    return { ok: true };
  }
}

@Module({ controllers: [LimitedController] })
class LimitedModule {}

let app: NestFastifyApplication | undefined;

afterEach(async () => {
  await app?.close();
  app = undefined;
});

// Unique addresses per test run so fixed windows from earlier runs never interfere.
const uniqueIp = (): string =>
  `10.${String(Math.floor(Math.random() * 250))}.${String(Math.floor(Math.random() * 250))}.${String(Math.floor(Math.random() * 250))}`;

async function hit(
  target: NestFastifyApplication,
  ip: string,
): Promise<{ status: number; retryAfter: string | undefined }> {
  const res = await target.inject({
    method: 'GET',
    url: '/v1/limited',
    remoteAddress: ip,
    headers: { 'x-service-token': serviceToken(), 'x-test-run': randomUUID() },
  });
  const retry = res.headers['retry-after'];
  return { status: res.statusCode, retryAfter: typeof retry === 'string' ? retry : undefined };
}

describe('rate limit', () => {
  it('rejects the request that exceeds the per-minute budget for one client', async () => {
    app = await startApp({
      env: testEnv({ RATE_LIMIT_PER_MINUTE: '3' }),
      imports: [LimitedModule],
    });
    const ip = uniqueIp();
    const results = [];
    for (let i = 0; i < 4; i += 1) results.push(await hit(app, ip));
    expect(results.map((r) => r.status)).toEqual([200, 200, 200, 429]);
    expect(Number(results[3]?.retryAfter)).toBeGreaterThan(0);
  });

  it('counts each client separately', async () => {
    app = await startApp({
      env: testEnv({ RATE_LIMIT_PER_MINUTE: '1' }),
      imports: [LimitedModule],
    });
    expect((await hit(app, uniqueIp())).status).toBe(200);
    expect((await hit(app, uniqueIp())).status).toBe(200);
  });

  it('fails open when the cache is unreachable', async () => {
    app = await startApp({
      env: testEnv({ RATE_LIMIT_PER_MINUTE: '1', VALKEY_CACHE_URL: 'redis://:pw@127.0.0.1:1/0' }),
      imports: [LimitedModule],
    });
    const ip = uniqueIp();
    expect([(await hit(app, ip)).status, (await hit(app, ip)).status]).toEqual([200, 200]);
  });
});
