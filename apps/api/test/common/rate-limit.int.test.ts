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
  forwardedFor?: string,
): Promise<{ status: number; retryAfter: string | undefined }> {
  const res = await target.inject({
    method: 'GET',
    url: '/v1/limited',
    remoteAddress: ip,
    headers: {
      'x-service-token': serviceToken(),
      'x-test-run': randomUUID(),
      ...(forwardedFor === undefined ? {} : { 'x-forwarded-for': forwardedFor }),
    },
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

  describe('internal bucket for server-side rendering', () => {
    const statuses = async (n: number, ip: string, xff?: string): Promise<number[]> => {
      if (app === undefined) throw new Error('app not started');
      const out: number[] = [];
      for (let i = 0; i < n; i += 1) out.push((await hit(app, ip, xff)).status);
      return out;
    };

    it('gives requests from the trusted proxy without X-Forwarded-For their own, larger budget', async () => {
      const proxy = uniqueIp();
      app = await startApp({
        env: testEnv({
          RATE_LIMIT_PER_MINUTE: '2',
          RATE_LIMIT_INTERNAL_PER_MINUTE: '5',
          TRUSTED_PROXY_IPS: proxy,
        }),
        imports: [LimitedModule],
      });
      expect(await statuses(6, proxy)).toEqual([200, 200, 200, 200, 200, 429]);
    });

    it('still limits each visitor forwarded by the proxy separately', async () => {
      const proxy = uniqueIp();
      app = await startApp({
        env: testEnv({
          RATE_LIMIT_PER_MINUTE: '2',
          RATE_LIMIT_INTERNAL_PER_MINUTE: '50',
          TRUSTED_PROXY_IPS: proxy,
        }),
        imports: [LimitedModule],
      });
      expect(await statuses(3, proxy, uniqueIp())).toEqual([200, 200, 429]);
    });

    it('never puts an untrusted caller in the internal bucket', async () => {
      app = await startApp({
        env: testEnv({
          RATE_LIMIT_PER_MINUTE: '2',
          RATE_LIMIT_INTERNAL_PER_MINUTE: '50',
          TRUSTED_PROXY_IPS: uniqueIp(),
        }),
        imports: [LimitedModule],
      });
      expect(await statuses(3, uniqueIp())).toEqual([200, 200, 429]);
    });
  });
});
