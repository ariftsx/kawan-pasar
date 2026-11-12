import { HistoryQuerySchema } from '@kawan-pasar/contracts';
import type { HistoryRange } from '@kawan-pasar/contracts';
import { Controller, Get, Header, Param, Query } from '@nestjs/common';
import { resolveMarket } from '../../common/catalog-lookup.js';
import { ZodValidationPipe } from '../../common/zod-validation.pipe.js';
import { PricesService } from './prices.service.js';

/**
 * Responses are the cached JSON text (validated against the contract when cached), sent without
 * re-serialisation: PriceSummaryResponse and HistoryResponse respectively.
 */
@Controller('v1/markets/:market')
export class PricesController {
  constructor(private readonly prices: PricesService) {}

  @Get('prices')
  @Header('content-type', 'application/json; charset=utf-8')
  summary(@Param('market') market: string): Promise<string> {
    return this.prices.summary(resolveMarket(market));
  }

  @Get('commodities/:commodity/history')
  @Header('content-type', 'application/json; charset=utf-8')
  history(
    @Param('market') market: string,
    @Param('commodity') commodity: string,
    @Query(new ZodValidationPipe(HistoryQuerySchema)) query: { range: HistoryRange },
  ): Promise<string> {
    return this.prices.history(resolveMarket(market), commodity, query.range);
  }
}
