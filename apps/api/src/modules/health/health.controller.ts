import { Controller, Get, HttpStatus, Inject, Res } from '@nestjs/common';
import type { FastifyReply } from 'fastify';
import type { Redis } from 'ioredis';
import type pg from 'pg';
import { VALKEY_CACHE } from '../../cache/tokens.js';
import { Public } from '../../common/public.decorator.js';
import { PG_POOL } from '../../database/database.module.js';

type CheckState = 'up' | 'down';

interface ReadyBody {
  readonly status: 'ok' | 'error';
  readonly checks: { readonly database: CheckState; readonly cache: CheckState };
}

const CHECK_TIMEOUT_MS = 1_500;

async function probe(run: () => Promise<unknown>): Promise<CheckState> {
  let timer: NodeJS.Timeout | undefined;
  const timeout = new Promise<never>((_, reject) => {
    timer = setTimeout(() => {
      reject(new Error('timeout'));
    }, CHECK_TIMEOUT_MS);
  });
  try {
    await Promise.race([run(), timeout]);
    return 'up';
  } catch {
    // Details stay internal: health responses never reveal versions, hosts or errors.
    return 'down';
  } finally {
    clearTimeout(timer);
  }
}

@Public()
@Controller('health')
export class HealthController {
  constructor(
    @Inject(PG_POOL) private readonly pool: pg.Pool,
    @Inject(VALKEY_CACHE) private readonly cache: Redis,
  ) {}

  @Get('live')
  live(): { status: 'ok' } {
    return { status: 'ok' };
  }

  @Get('ready')
  async ready(@Res({ passthrough: true }) reply: FastifyReply): Promise<ReadyBody> {
    const [database, cache] = await Promise.all([
      probe(() => this.pool.query('SELECT 1')),
      probe(() => this.cache.ping()),
    ]);
    const ok = database === 'up' && cache === 'up';
    void reply.status(ok ? HttpStatus.OK : HttpStatus.SERVICE_UNAVAILABLE);
    return { status: ok ? 'ok' : 'error', checks: { database, cache } };
  }
}
