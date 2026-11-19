import type { Type } from '@nestjs/common';
import type { NestFastifyApplication } from '@nestjs/platform-fastify';
import { createApp } from '../../src/app.factory.js';
import type { Clock } from '../../src/common/clock.js';
import { loadEnv } from '../../src/config/env.js';
import type { Env } from '../../src/config/env.js';

/** Env for integration tests: the test database (through PgBouncer) and the local Valkey. */
export function testEnv(overrides: Record<string, string> = {}): Env {
  return loadEnv({
    NODE_ENV: 'test',
    LOG_LEVEL: 'silent',
    DATABASE_URL: process.env['TEST_DATABASE_URL'] ?? '',
    VALKEY_CACHE_URL: process.env['VALKEY_CACHE_URL'] ?? '',
    VALKEY_QUEUE_URL: process.env['VALKEY_QUEUE_URL'] ?? '',
    SERVICE_TOKEN: process.env['SERVICE_TOKEN'] ?? '',
    VALKEY_SESSION_URL: process.env['VALKEY_SESSION_URL'] ?? '',
    AUTH_SECRET: process.env['AUTH_SECRET'] ?? '',
    PHONE_ENC_KEY: process.env['PHONE_ENC_KEY'] ?? '',
    SMTP_URL: process.env['SMTP_URL'] ?? '',
    MAIL_FROM: 'Kawan Pasar <no-reply@kawanpasar.local>',
    PUBLIC_SITE_URL: 'http://127.0.0.1:8080',
    ...overrides,
  });
}

export const serviceToken = (): string => process.env['SERVICE_TOKEN'] ?? '';

export interface StartOptions {
  readonly env?: Env;
  readonly imports?: readonly Type[];
  readonly clock?: Clock;
  readonly logDestination?: NodeJS.WritableStream;
}

/** Builds and fully initialises the API (no port is opened; use `app.inject`). */
export async function startApp(options: StartOptions = {}): Promise<NestFastifyApplication> {
  const app = await createApp(options.env ?? testEnv(), {
    ...(options.imports === undefined ? {} : { imports: options.imports }),
    ...(options.clock === undefined ? {} : { clock: options.clock }),
    ...(options.logDestination === undefined ? {} : { logDestination: options.logDestination }),
  });
  await app.init();
  await app.getHttpAdapter().getInstance().ready();
  return app;
}

export function fixedClock(iso: string): Clock & { set(next: string): void } {
  let current = new Date(iso);
  return {
    now: () => new Date(current),
    set: (next: string) => {
      current = new Date(next);
    },
  };
}
