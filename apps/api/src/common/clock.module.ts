import { Global, Module } from '@nestjs/common';
import type { DynamicModule } from '@nestjs/common';
import { CLOCK, systemClock } from './clock.js';
import type { Clock } from './clock.js';

/** Makes the CLOCK token available everywhere (tests replace it with a fixed clock). */
@Global()
@Module({})
export class ClockModule {
  static forRoot(clock: Clock = systemClock): DynamicModule {
    return {
      module: ClockModule,
      providers: [{ provide: CLOCK, useValue: clock }],
      exports: [CLOCK],
    };
  }
}
