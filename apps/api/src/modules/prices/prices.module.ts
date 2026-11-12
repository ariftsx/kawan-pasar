import { Module } from '@nestjs/common';
import { ActiveArtifactRepository } from '../forecasts/active-artifact.repository.js';
import { PricesController } from './prices.controller.js';
import { PricesRepository } from './prices.repository.js';
import { PricesService } from './prices.service.js';

@Module({
  controllers: [PricesController],
  providers: [PricesRepository, PricesService, ActiveArtifactRepository],
})
export class PricesModule {}
