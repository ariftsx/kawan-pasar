import { Writable } from 'node:stream';
import type { NestFastifyApplication } from '@nestjs/platform-fastify';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { serviceToken, startApp, testEnv } from '../helpers/test-app.js';

const lines: string[] = [];
const sink = new Writable({
  write(chunk: Buffer, _encoding, callback) {
    lines.push(...chunk.toString('utf8').split('\n').filter(Boolean));
    callback();
  },
});

let app: NestFastifyApplication;

beforeAll(async () => {
  app = await startApp({ env: testEnv({ LOG_LEVEL: 'info' }), logDestination: sink });
});

afterAll(async () => {
  await app.close();
});

describe('request logging', () => {
  it('logs every API request with its route and status', async () => {
    await app.inject({
      method: 'GET',
      url: '/v1/markets',
      headers: { 'x-service-token': serviceToken() },
    });
    const entry = lines.find((l) => l.includes('"/v1/markets"'));
    expect(entry).toBeDefined();
    expect(entry).toContain('"statusCode":200');
  });

  it('never writes the service token to the logs', async () => {
    await app.inject({
      method: 'GET',
      url: '/v1/markets',
      headers: { 'x-service-token': serviceToken() },
    });
    expect(lines.join('\n')).not.toContain(serviceToken());
    expect(lines.some((l) => l.includes('[redacted]'))).toBe(true);
  });

  it('does not log health probes', async () => {
    const before = lines.length;
    await app.inject({ method: 'GET', url: '/health/live' });
    expect(lines.slice(before).some((l) => l.includes('/health/live'))).toBe(false);
  });
});
