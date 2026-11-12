import { Body, Controller, HttpCode, HttpStatus, Post } from '@nestjs/common';
import { z } from 'zod';
import { CacheService } from '../../cache/cache.service.js';
import type { InvalidateScope } from '../../cache/cache.service.js';
import { ZodValidationPipe } from '../../common/zod-validation.pipe.js';
import { WebRevalidator, tagsForScope } from './web-revalidator.js';

export const InvalidateBodySchema = z.strictObject({
  scope: z.enum(['prices', 'forecasts', 'articles', 'all']),
});

/** Internal maintenance endpoints (service token required, like every non-public route). */
@Controller('internal')
export class InternalController {
  constructor(
    private readonly cache: CacheService,
    private readonly web: WebRevalidator,
  ) {}

  /**
   * Called by ingest and bundle promotion after data changes. Drops the API cache, then asks
   * the web server to revalidate the affected pages (best effort; see WebRevalidator).
   */
  @Post('cache/invalidate')
  @HttpCode(HttpStatus.OK)
  async invalidate(
    @Body(new ZodValidationPipe(InvalidateBodySchema)) body: { scope: InvalidateScope },
  ): Promise<{ deleted: number }> {
    const deleted = await this.cache.invalidate(body.scope);
    await this.web.revalidate(tagsForScope(body.scope));
    return { deleted };
  }
}
