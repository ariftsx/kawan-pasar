// Builds the HTTP app; shared by main.ts and the integration tests so both run the same stack.
import 'reflect-metadata';

import helmet from '@fastify/helmet';
import { NestFactory } from '@nestjs/core';
import { FastifyAdapter, type NestFastifyApplication } from '@nestjs/platform-fastify';
import { Logger } from 'nestjs-pino';

import { AppModule } from './app.module.js';

import type { Env } from './config/env.js';

/** docs 13 §A3: 64 KB default; tighter per-route limits arrive with the routes that need them. */
const BODY_LIMIT_BYTES = 64 * 1024;

export async function createApp(env: Env): Promise<NestFastifyApplication> {
  const adapter = new FastifyAdapter({
    trustProxy: env.TRUSTED_PROXY_CIDRS,
    bodyLimit: BODY_LIMIT_BYTES,
    return503OnClosing: true,
  });
  const app = await NestFactory.create<NestFastifyApplication>(AppModule.forRoot(env), adapter, {
    bufferLogs: true,
  });
  app.useLogger(app.get(Logger));

  // JSON-only API, so CSP is off; the remaining helmet headers stay on. CORS stays disabled.
  await app.register(helmet, { contentSecurityPolicy: false });

  app.enableShutdownHooks();
  return app;
}
