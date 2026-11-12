import { HistoryQuerySchema } from '@kawan-pasar/contracts';
import type { HistoryRange } from '@kawan-pasar/contracts';
import { Controller, Get, Module, Query, Req } from '@nestjs/common';
import type { NestFastifyApplication } from '@nestjs/platform-fastify';
import type { FastifyRequest } from 'fastify';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { clientIp } from '../../src/common/client-ip.js';
import { ZodValidationPipe } from '../../src/common/zod-validation.pipe.js';
import { serviceToken, startApp, testEnv } from '../helpers/test-app.js';

@Controller('v1/probe')
class ProbeController {
  @Get('boom')
  boom(): never {
    throw new Error('db password=hunter2 at /srv/app/db.ts:12');
  }

  @Get('ip')
  ip(@Req() req: FastifyRequest): { ip: string } {
    return { ip: clientIp(req) };
  }

  @Get('validate')
  validate(@Query(new ZodValidationPipe(HistoryQuerySchema)) query: { range: HistoryRange }): {
    range: HistoryRange;
  } {
    return query;
  }
}

@Module({ controllers: [ProbeController] })
class ProbeModule {}

let app: NestFastifyApplication;
const auth = (): Record<string, string> => ({ 'x-service-token': serviceToken() });

beforeAll(async () => {
  app = await startApp({
    env: testEnv({ TRUSTED_PROXY_IPS: '172.30.0.10', RATE_LIMIT_PER_MINUTE: '1000' }),
    imports: [ProbeModule],
  });
});

afterAll(async () => {
  await app.close();
});

describe('error responses', () => {
  it('reports invalid query fields by name without echoing their values', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/v1/probe/validate?range=7d-evil',
      headers: auth(),
    });
    expect(res.statusCode).toBe(400);
    expect(res.json()).toEqual({
      error: { code: 'bad_request', message: 'invalid request', fields: ['range'] },
    });
    expect(res.body).not.toContain('evil');
  });

  it('answers unknown routes with a generic 404 that does not reflect the path', async () => {
    const res = await app.inject({ method: 'GET', url: '/v1/tidak-ada', headers: auth() });
    expect(res.statusCode).toBe(404);
    expect(res.json()).toEqual({ error: { code: 'not_found', message: 'resource not found' } });
  });

  it('hides internal error details behind a generic 500', async () => {
    const res = await app.inject({ method: 'GET', url: '/v1/probe/boom', headers: auth() });
    expect(res.statusCode).toBe(500);
    expect(res.json()).toEqual({ error: { code: 'internal', message: 'internal error' } });
    expect(res.body).not.toMatch(/password|hunter2|\/srv/);
  });
});

describe('service token', () => {
  it('rejects requests without a token', async () => {
    const res = await app.inject({ method: 'GET', url: '/v1/probe/ip' });
    expect(res.statusCode).toBe(401);
    expect(res.json()).toEqual({ error: { code: 'unauthorized', message: 'unauthorized' } });
  });

  it('rejects a wrong token of a different length without crashing', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/v1/probe/ip',
      headers: { 'x-service-token': 'short' },
    });
    expect(res.statusCode).toBe(401);
  });

  it('accepts the configured token', async () => {
    const res = await app.inject({ method: 'GET', url: '/v1/probe/ip', headers: auth() });
    expect(res.statusCode).toBe(200);
  });

  it('keeps health endpoints public', async () => {
    const res = await app.inject({ method: 'GET', url: '/health/live' });
    expect(res.statusCode).toBe(200);
  });
});

describe('client ip behind the trusted proxy', () => {
  it('uses X-Forwarded-For only when the request comes from the trusted proxy', async () => {
    const trusted = await app.inject({
      method: 'GET',
      url: '/v1/probe/ip',
      remoteAddress: '172.30.0.10',
      headers: { ...auth(), 'x-forwarded-for': '1.2.3.4' },
    });
    expect(trusted.json()).toEqual({ ip: '1.2.3.4' });
  });

  it('ignores X-Forwarded-For from any other peer', async () => {
    const spoofed = await app.inject({
      method: 'GET',
      url: '/v1/probe/ip',
      remoteAddress: '10.9.9.9',
      headers: { ...auth(), 'x-forwarded-for': '1.2.3.4' },
    });
    expect(spoofed.json()).toEqual({ ip: '10.9.9.9' });
  });
});
