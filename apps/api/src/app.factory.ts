import 'reflect-metadata';
import { randomUUID } from 'node:crypto';
import helmet from '@fastify/helmet';
import { NestFactory } from '@nestjs/core';
import { FastifyAdapter } from '@nestjs/platform-fastify';
import type { NestFastifyApplication } from '@nestjs/platform-fastify';
import { Logger } from 'nestjs-pino';
import { AppModule } from './app.module.js';
import type { Env } from './config/env.js';

const ONE_MIB = 1_048_576;

/** Only proxies on private container networks (Traefik) may set X-Forwarded-* headers. */
const TRUSTED_PROXIES = ['10.0.0.0/8', '172.16.0.0/12', '192.168.0.0/16'];

/** Builds the configured Core API application. Shared by `main.ts` and the tests. */
export async function createApp(env: Env): Promise<NestFastifyApplication> {
  const adapter = new FastifyAdapter({
    bodyLimit: ONE_MIB,
    trustProxy: TRUSTED_PROXIES,
    // Never trust a client-supplied request id: it ends up in logs.
    genReqId: () => randomUUID(),
    connectionTimeout: 10_000,
    requestTimeout: 15_000,
    keepAliveTimeout: 65_000,
    return503OnClosing: true,
  });

  const app = await NestFactory.create<NestFastifyApplication>(AppModule.forRoot(env), adapter, {
    bufferLogs: true,
  });
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
