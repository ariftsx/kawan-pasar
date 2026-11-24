import { Module } from '@nestjs/common';
import { ForecastsController } from './forecasts.controller.js';
import { ForecastsRepository } from './forecasts.repository.js';
import { CoverageService } from './coverage.service.js';
import { ForecastsService } from './forecasts.service.js';

@Module({
  controllers: [ForecastsController],
  providers: [ForecastsRepository, ForecastsService, CoverageService],
})
export class ForecastsModule {}
