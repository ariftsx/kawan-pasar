import { Global, Module } from '@nestjs/common';
import type { DynamicModule } from '@nestjs/common';
import type { Env } from './env.js';

export const ENV = Symbol('ENV');

/** Exposes the already-validated environment to every module via the ENV token. */
@Global()
@Module({})
export class ConfigModule {
  static forRoot(env: Env): DynamicModule {
    return {
      module: ConfigModule,
      providers: [{ provide: ENV, useValue: Object.freeze({ ...env }) }],
      exports: [ENV],
    };
  }
}
