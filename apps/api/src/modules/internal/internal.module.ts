import { Logger, Module } from '@nestjs/common';
import { ENV } from '../../config/config.module.js';
import type { Env } from '../../config/env.js';
import { ThrottledWarning } from '../../common/throttled-log.js';
import { InternalController } from './internal.controller.js';
import { WebRevalidator } from './web-revalidator.js';

const logger = new Logger('WebRevalidator');
const warnings = new ThrottledWarning(10_000, (m) => {
  logger.warn(m);
});

@Module({
  controllers: [InternalController],
  providers: [
    {
      provide: WebRevalidator,
      inject: [ENV],
      useFactory: (env: Env): WebRevalidator =>
        new WebRevalidator(
          env.WEB_INTERNAL_URL !== undefined && env.WEB_REVALIDATE_TOKEN !== undefined
            ? { url: env.WEB_INTERNAL_URL, token: env.WEB_REVALIDATE_TOKEN }
            : null,
          fetch,
          (m) => {
            warnings.warn('web', m);
          },
        ),
    },
  ],
})
export class InternalModule {}
