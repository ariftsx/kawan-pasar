import type { ForecastResponse } from '@kawan-pasar/contracts';
import { Controller, Get, Param } from '@nestjs/common';
import { resolveMarket } from '../../common/catalog-lookup.js';
import { ForecastsService } from './forecasts.service.js';

@Controller('v1/markets/:market/commodities/:commodity')
export class ForecastsController {
  constructor(private readonly forecasts: ForecastsService) {}

  @Get('forecast')
  forecast(
    @Param('market') market: string,
    @Param('commodity') commodity: string,
  ): Promise<ForecastResponse> {
    return this.forecasts.forCommodity(resolveMarket(market), commodity);
  }
}
