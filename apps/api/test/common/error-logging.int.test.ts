import { Writable } from 'node:stream';
import type { NestFastifyApplication } from '@nestjs/platform-fastify';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { serviceToken, startApp, testEnv } from '../helpers/test-app.js';

// Database errors carry the query parameters in their message (Drizzle: "params: …"). An
// e-mail address reached the error log this way under the Fase 2A sign-in flood.

const EMAIL = 'rahasia.sekali@contoh.id';
const lines: string[] = [];
let app: NestFastifyApplication;

beforeAll(async () => {
  app = await startApp({
    env: testEnv({
      LOG_LEVEL: 'info',
      DATABASE_URL: 'postgres://app_rw:pw@127.0.0.1:1/kawanpasar',
    }),
    logDestination: new Writable({
      write(chunk: Buffer, _enc, done) {
        lines.push(chunk.toString('utf8'));
        done();
      },
    }),
  });
});

afterAll(async () => {
  await app.close();
});

describe('unexpected errors', () => {
  it('answer a generic 500 and log the error kind, never its message or the input', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/v1/auth/login',
      headers: { 'x-service-token': serviceToken() },
      payload: { email: EMAIL, password: 'kata sandi apa saja' },
    });
    expect(res.statusCode).toBe(500);
    expect(res.json()).toEqual({ error: { code: 'internal', message: 'internal error' } });
    const all = lines.join('');
    // Kind and SQLSTATE/driver code only (here: the database refused the connection).
    expect(all).toContain('unexpected Error, cause Error, code ECONNREFUSED');
    expect(all).not.toContain(EMAIL);
    expect(all).not.toContain('rahasia');
  });
});
