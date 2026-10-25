import { ErrorEnvelope } from '@kawan-pasar/contracts';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { createApp } from './app.factory.js';
import { TEST_SERVICE_TOKEN, testEnv } from './test-env.fixture.js';

import type { NestFastifyApplication } from '@nestjs/platform-fastify';

let app: NestFastifyApplication;

beforeAll(async () => {
  app = await createApp(testEnv());
  await app.init();
  await app.getHttpAdapter().getInstance().ready();
});

afterAll(async () => {
  await app.close();
});

const inject = (url: string, headers: Record<string, string> = {}) =>
  app.getHttpAdapter().getInstance().inject({ method: 'GET', url, headers });

describe('core API boot', () => {
  it.each(['/healthz', '/readyz'])('answers %s without a service token', async (url) => {
    const response = await inject(url);
    expect(response.statusCode).toBe(200);
    expect(response.json()).toMatchObject({ status: 'ok' });
    expect(response.headers['cache-control']).toBe('no-store');
  });

  it('mints a request id and echoes it in the response header', async () => {
    const response = await inject('/healthz');
    expect(response.headers['x-request-id']).toMatch(/^req_[0-9A-HJKMNP-TV-Z]{26}$/);
  });

  it('sets helmet headers but no CSP on JSON responses', async () => {
    const response = await inject('/healthz');
    expect(response.headers['x-content-type-options']).toBe('nosniff');
    expect(response.headers['content-security-policy']).toBeUndefined();
    expect(response.headers['access-control-allow-origin']).toBeUndefined();
  });

  it('returns the contract error envelope with the propagated request id', async () => {
    const response = await inject('/v1/does-not-exist', {
      'x-service-token': TEST_SERVICE_TOKEN,
      'x-request-id': 'req_from_bff',
    });
    expect(response.statusCode).toBe(404);
    expect(response.headers['x-request-id']).toBe('req_from_bff');
    const body = ErrorEnvelope.parse(response.json());
    expect(body.error).toEqual({
      code: 'NOT_FOUND',
      message: 'Sumber daya tidak ditemukan.',
      request_id: 'req_from_bff',
    });
  });
});
