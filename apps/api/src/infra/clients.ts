// Connections to the data stores (docs 13 §A8). Both clients connect lazily, so the app boots
// even when a store is down; /readyz reports it instead.
import { Logger } from '@nestjs/common';
import { Redis } from 'ioredis';
import postgres from 'postgres';

import type { Env } from '../config/env.js';

export const SQL = Symbol('SQL');
export const VALKEY_CACHE = Symbol('VALKEY_CACHE');
export const VALKEY_QUEUE = Symbol('VALKEY_QUEUE');

export type Sql = postgres.Sql;

/** docs 13 §A8: 10 connections per api replica. */
const POOL_SIZE = 10;

export function createSql(env: Env): Sql {
  return postgres(env.DATABASE_URL, {
    max: POOL_SIZE,
    connect_timeout: 2,
    idle_timeout: 60,
    // postgres.js would otherwise log NOTICE messages with console.log.
    onnotice: () => undefined,
  });
}

const logger = new Logger('Valkey');

export function createValkey(url: string): Redis {
  const client = new Redis(url, {
    lazyConnect: true,
    // Fail fast instead of queueing commands while disconnected.
    enableOfflineQueue: false,
    maxRetriesPerRequest: 1,
    connectTimeout: 2000,
  });
  // Without a listener ioredis prints "Unhandled error event"; /readyz reports the outage.
  client.on('error', (error: Error) => {
    logger.warn(`connection error: ${error.message}`);
  });
  return client;
}

/** With lazyConnect and no offline queue, the first command must open the connection itself. */
export async function pingValkey(client: Redis): Promise<string> {
  if (client.status === 'wait') await client.connect();
  return client.ping();
}
