import { Module, type DynamicModule } from '@nestjs/common';
import { LoggerModule } from 'nestjs-pino';

import { ConfigModule } from './config/config.module.js';
import { HealthModule } from './modules/health/health.module.js';

import type { Env } from './config/env.js';

/** Log redaction (docs 13 §A9): credentials never reach a log line. */
const REDACT = [
  'req.headers.authorization',
  'req.headers.cookie',
  'req.headers["x-service-token"]',
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
            redact: { paths: REDACT, censor: '[redacted]' },
            autoLogging: { ignore: (request) => PROBE_PATHS.has(String(request.url)) },
          },
        }),
        HealthModule,
      ],
    };
  }
}
