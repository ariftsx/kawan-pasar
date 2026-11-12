import { MARKETS } from '@kawan-pasar/catalog';
import type { MarketsResponse } from '@kawan-pasar/contracts';
import { Controller, Get } from '@nestjs/common';
import { toMarketDto } from '../../common/catalog-lookup.js';

/** Markets come from the catalog (which also seeds the database): no query needed. */
@Controller('v1/markets')
export class MarketsController {
  @Get()
  list(): MarketsResponse {
    return { items: MARKETS.map(toMarketDto) };
  }
}
