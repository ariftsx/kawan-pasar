import { Module, type DynamicModule } from '@nestjs/common';
import { APP_FILTER, APP_GUARD } from '@nestjs/core';
import { LoggerModule } from 'nestjs-pino';

import { AllExceptionsFilter } from './common/all-exceptions.filter.js';
import { resolveRequestId } from './common/request-id.js';
import { SERVICE_TOKEN_HEADER, ServiceTokenGuard } from './common/service-token.guard.js';
import { ConfigModule } from './config/config.module.js';
import { InfraModule } from './infra/infra.module.js';
import { HealthModule } from './modules/health/health.module.js';

import type { Env } from './config/env.js';

/** Log redaction (docs 13 §A9): credentials never reach a log line. */
const REDACT = [
  'req.headers.authorization',
  'req.headers.cookie',
  `req.headers["${SERVICE_TOKEN_HEADER}"]`,
  'res.headers["set-cookie"]',
];

/** Probes run every few seconds; logging them would drown real traffic. */
const PROBE_PATHS = new Set(['/healthz', '/readyz']);

@Module({})
export class AppModule {
  static forRoot(env: Env): DynamicModule {
    return {
      module: AppModule,
      imports: [
        ConfigModule.forRoot(env),
        LoggerModule.forRoot({
          pinoHttp: {
            level: env.LOG_LEVEL,
            genReqId: (request) => resolveRequestId(request),
            customAttributeKeys: { reqId: 'request_id' },
            redact: { paths: REDACT, censor: '[redacted]' },
            autoLogging: { ignore: (request) => PROBE_PATHS.has(String(request.url)) },
          },
        }),
        InfraModule,
        HealthModule,
      ],
      providers: [
        { provide: APP_GUARD, useClass: ServiceTokenGuard },
        { provide: APP_FILTER, useClass: AllExceptionsFilter },
      ],
    };
  }
}
