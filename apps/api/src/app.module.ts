import { Module } from '@nestjs/common';
import type { DynamicModule } from '@nestjs/common';
import { LoggerModule } from 'nestjs-pino';
import { ValkeyModule } from './cache/valkey.module.js';
import { ConfigModule } from './config/config.module.js';
import type { Env } from './config/env.js';
import { DatabaseModule } from './database/database.module.js';
import { HealthModule } from './modules/health/health.module.js';

/** Paths whose values must never reach the logs. */
const REDACT = [
  'req.headers.authorization',
  'req.headers.cookie',
  'req.headers["x-service-token"]',
  'res.headers["set-cookie"]',
  '*.password',
  '*.token',
];

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
            customProps: () => ({ service: 'api' }),
            autoLogging: { ignore: (req) => req.url?.startsWith('/health') ?? false },
          },
        }),
        DatabaseModule,
        ValkeyModule,
        HealthModule,
      ],
    };
  }
}
