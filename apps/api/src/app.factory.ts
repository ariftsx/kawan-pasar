import 'reflect-metadata';
import { randomUUID } from 'node:crypto';
import helmet from '@fastify/helmet';
import type { Type } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { FastifyAdapter } from '@nestjs/platform-fastify';
import type { NestFastifyApplication } from '@nestjs/platform-fastify';
import { Logger } from 'nestjs-pino';
import { AppModule } from './app.module.js';
import type { Clock } from './common/clock.js';
import type { Env } from './config/env.js';

const ONE_MIB = 1_048_576;

export interface AppOptions {
  /** Extra modules (used by tests to mount probe controllers). */
  readonly imports?: readonly Type[];
  /** Replaces the system clock (tests). */
  readonly clock?: Clock;
  /** Where request logs are written (default stdout); tests capture them. */
  readonly logDestination?: NodeJS.WritableStream;
}

/** Builds the configured Core API application. Shared by `main.ts` and the tests. */
export async function createApp(
  env: Env,
  options: AppOptions = {},
): Promise<NestFastifyApplication> {
  const adapter = new FastifyAdapter({
    bodyLimit: ONE_MIB,
    // Only the configured proxy (the web/BFF container) may set X-Forwarded-For. With an empty
    // list nothing is trusted and request.ip is always the socket peer.
    trustProxy: env.TRUSTED_PROXY_IPS.length > 0 ? [...env.TRUSTED_PROXY_IPS] : false,
    // Never trust a client-supplied request id: it ends up in logs.
    genReqId: () => randomUUID(),
    connectionTimeout: 10_000,
    requestTimeout: 15_000,
    keepAliveTimeout: 65_000,
    return503OnClosing: true,
  });

  const app = await NestFactory.create<NestFastifyApplication>(
    AppModule.forRoot(env, options),
    adapter,
    {
      bufferLogs: true,
    },
  );
  app.useLogger(app.get(Logger));
  app.enableShutdownHooks();

  await app.register(helmet, {
    // JSON API: nothing may be rendered or framed from its responses.
    contentSecurityPolicy: {
      useDefaults: false,
      directives: {
        defaultSrc: ["'none'"],
        baseUri: ["'none'"],
        formAction: ["'none'"],
        frameAncestors: ["'none'"],
      },
    },
    crossOriginResourcePolicy: { policy: 'same-origin' },
    hsts: env.NODE_ENV === 'production',
  });

  const fastify = app.getHttpAdapter().getInstance();
  fastify.addHook('onRequest', (request, reply, done) => {
    void reply.header('x-request-id', request.id);
    done();
  });

  return app;
}
