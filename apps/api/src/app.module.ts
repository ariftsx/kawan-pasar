import { Module, RequestMethod } from '@nestjs/common';
import type { DynamicModule } from '@nestjs/common';
import { APP_FILTER, APP_GUARD } from '@nestjs/core';
import { LoggerModule } from 'nestjs-pino';
import type { AppOptions } from './app.factory.js';
import { ValkeyModule } from './cache/valkey.module.js';
import { ApiExceptionFilter } from './common/api-exception.filter.js';
import { ClockModule } from './common/clock.module.js';
import { RateLimitGuard } from './common/rate-limit.guard.js';
import { ServiceTokenGuard } from './common/service-token.guard.js';
import { ConfigModule } from './config/config.module.js';
import type { Env } from './config/env.js';
import { DatabaseModule } from './database/database.module.js';
import { ArticlesModule } from './modules/articles/articles.module.js';
import { AlertsModule } from './modules/alerts/alerts.module.js';
import { AdminModule } from './modules/admin/admin.module.js';
import { AnalystModule } from './modules/analyst/analyst.module.js';
import { WhatsAppModule } from './modules/whatsapp/whatsapp.module.js';
import { AuthModule } from './modules/auth/auth.module.js';
import { ForecastsModule } from './modules/forecasts/forecasts.module.js';
import { HealthModule } from './modules/health/health.module.js';
import { InternalModule } from './modules/internal/internal.module.js';
import { MarketsModule } from './modules/markets/markets.module.js';
import { PricesModule } from './modules/prices/prices.module.js';

/** Paths whose values must never reach the logs. */
const REDACT = [
  'req.headers.authorization',
  'req.headers.cookie',
  'req.headers["x-service-token"]',
  'req.headers["x-session-token"]',
  'req.headers["x-csrf-token"]',
  'res.headers["set-cookie"]',
  '*.password',
  '*.token',
];

@Module({})
export class AppModule {
  static forRoot(env: Env, options: AppOptions = {}): DynamicModule {
    return {
      module: AppModule,
      imports: [
        ConfigModule.forRoot(env),
        ClockModule.forRoot(options.clock),
        LoggerModule.forRoot({
          pinoHttp: [
            {
              level: env.LOG_LEVEL,
              redact: { paths: REDACT, censor: '[redacted]' },
              customProps: () => ({ service: 'api' }),
            },
            options.logDestination ?? process.stdout,
          ],
          // Nest 11+ router syntax: the library default ('*') matches nothing, which silently
          // disabled request logging (and therefore the header redaction it applies).
          forRoutes: [{ path: '{*splat}', method: RequestMethod.ALL }],
          // Container probes hit these every few seconds; they would drown the request log.
          exclude: [{ path: 'health/{*splat}', method: RequestMethod.ALL }],
        }),
        DatabaseModule,
        ValkeyModule,
        HealthModule,
        InternalModule,
        MarketsModule,
        PricesModule,
        ForecastsModule,
        ArticlesModule,
        AuthModule,
        AlertsModule,
        WhatsAppModule,
        AnalystModule,
        AdminModule,
        ...(options.imports ?? []),
      ],
      providers: [
        // Order matters: authenticate first, then count against the rate limit.
        { provide: APP_GUARD, useClass: ServiceTokenGuard },
        { provide: APP_GUARD, useClass: RateLimitGuard },
        { provide: APP_FILTER, useClass: ApiExceptionFilter },
      ],
    };
  }
}
