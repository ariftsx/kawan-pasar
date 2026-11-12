import { Global, Inject, Logger, Module } from '@nestjs/common';
import type { OnApplicationShutdown } from '@nestjs/common';
import { Redis } from 'ioredis';
import { ENV } from '../config/config.module.js';
import type { Env } from '../config/env.js';
import { CacheService } from './cache.service.js';
import { VALKEY_CACHE } from './tokens.js';

export { VALKEY_CACHE } from './tokens.js';

const BOOT_WAIT_MS = 2_000;

/**
 * Waits briefly for the first connection so the API does not report "cache down" right after
 * boot. Never throws: if the cache is unavailable the API still starts and degrades to no cache.
 */
function firstConnection(client: Redis): Promise<void> {
  return new Promise((resolve) => {
    const finish = (): void => {
      clearTimeout(timer);
      client.off('ready', finish);
      client.off('error', finish);
      resolve();
    };
    const timer = setTimeout(finish, BOOT_WAIT_MS);
    client.once('ready', finish);
    client.once('error', finish);
  });
}

@Global()
@Module({
  providers: [
    {
      provide: VALKEY_CACHE,
      inject: [ENV],
      useFactory: async (env: Env): Promise<Redis> => {
        const client = new Redis(env.VALKEY_CACHE_URL, {
          // Fail fast instead of queueing commands while the cache is down: a cache outage must
          // degrade to "no cache", never to stalled requests.
          enableOfflineQueue: false,
          maxRetriesPerRequest: 1,
          connectTimeout: 2_000,
          commandTimeout: 1_000,
          lazyConnect: false,
        });
        // ioredis reconnects on its own; surface the failure in logs (readiness reports it too).
        const log = new Logger('ValkeyCache');
        client.on('error', (e: Error) => {
          log.warn(`cache connection error: ${e.message}`);
        });
        await firstConnection(client);
        return client;
      },
    },
    CacheService,
  ],
  exports: [VALKEY_CACHE, CacheService],
})
export class ValkeyModule implements OnApplicationShutdown {
  constructor(@Inject(VALKEY_CACHE) private readonly cache: Redis) {}

  onApplicationShutdown(): void {
    this.cache.disconnect();
  }
}
