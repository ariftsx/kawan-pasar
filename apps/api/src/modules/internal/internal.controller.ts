import { Body, Controller, HttpCode, HttpStatus, Post } from '@nestjs/common';
import { z } from 'zod';
import { CacheService } from '../../cache/cache.service.js';
import type { InvalidateScope } from '../../cache/cache.service.js';
import { ZodValidationPipe } from '../../common/zod-validation.pipe.js';

export const InvalidateBodySchema = z.strictObject({
  scope: z.enum(['prices', 'forecasts', 'articles', 'all']),
});

/** Internal maintenance endpoints (service token required, like every non-public route). */
@Controller('internal')
export class InternalController {
  constructor(private readonly cache: CacheService) {}

  /** Called by ingest and bundle promotion after data changes. */
  @Post('cache/invalidate')
  @HttpCode(HttpStatus.OK)
  async invalidate(
    @Body(new ZodValidationPipe(InvalidateBodySchema)) body: { scope: InvalidateScope },
  ): Promise<{ deleted: number }> {
    return { deleted: await this.cache.invalidate(body.scope) };
  }
}
