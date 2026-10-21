import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { createApp } from './app.factory.js';
import { testEnv } from './test-env.fixture.js';

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
  it.each(['/healthz', '/readyz'])('answers %s', async (url) => {
    const response = await inject(url);
    expect(response.statusCode).toBe(200);
    expect(response.json()).toMatchObject({ status: 'ok' });
    expect(response.headers['cache-control']).toBe('no-store');
  });

  it('sets helmet headers but no CSP on JSON responses', async () => {
    const response = await inject('/healthz');
    expect(response.headers['x-content-type-options']).toBe('nosniff');
    expect(response.headers['content-security-policy']).toBeUndefined();
    expect(response.headers['access-control-allow-origin']).toBeUndefined();
  });
});
