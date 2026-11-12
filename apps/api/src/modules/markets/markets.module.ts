import { Module } from '@nestjs/common';
import { MarketsController } from './markets.controller.js';

@Module({ controllers: [MarketsController] })
export class MarketsModule {}
