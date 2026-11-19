import { Body, Controller, HttpCode, HttpStatus, Inject, Logger, Post } from '@nestjs/common';
import { z } from 'zod';
import { CacheService } from '../../cache/cache.service.js';
import type { InvalidateScope } from '../../cache/cache.service.js';
import { ZodValidationPipe } from '../../common/zod-validation.pipe.js';
import { ALERTS_TRIGGER } from '../alerts/alerts.queue.js';
import type { AlertsTrigger } from '../alerts/alerts.queue.js';
import { WebRevalidator, tagsForScope } from './web-revalidator.js';

export const InvalidateBodySchema = z.strictObject({
  scope: z.enum(['prices', 'forecasts', 'articles', 'all']),
});

/** Internal maintenance endpoints (service token required, like every non-public route). */
@Controller('internal')
export class InternalController {
  private readonly log = new Logger('InternalController');

  constructor(
    private readonly cache: CacheService,
    private readonly web: WebRevalidator,
    @Inject(ALERTS_TRIGGER) private readonly alerts: AlertsTrigger,
  ) {}

  /**
   * Called by ingest and bundle promotion after data changes. Drops the API cache, asks the web
   * server to revalidate the affected pages (best effort; see WebRevalidator), and, for prices
   * and forecasts, queues one evaluation of every alert watch (Fase 2B).
   */
  @Post('cache/invalidate')
  @HttpCode(HttpStatus.OK)
  async invalidate(
    @Body(new ZodValidationPipe(InvalidateBodySchema)) body: { scope: InvalidateScope },
  ): Promise<{ deleted: number }> {
    const deleted = await this.cache.invalidate(body.scope);
    await this.web.revalidate(tagsForScope(body.scope));
    if (body.scope !== 'articles') {
      // Best effort: a queue outage must not fail the data import that called us.
      await this.alerts.dataChanged().catch((e: unknown) => {
        this.log.warn(`alerts evaluation not queued: ${e instanceof Error ? e.name : 'error'}`);
      });
    }
    return { deleted };
  }
}
