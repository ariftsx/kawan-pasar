import { serverEnv } from '@/lib/env';
import { log } from '@/lib/log';

export const dynamic = 'force-dynamic';

const NO_STORE = { 'cache-control': 'no-store' };

/**
 * Liveness for the container healthcheck and Traefik. Does not call the API, but validates the
 * server environment: a misconfigured replica turns unhealthy right after start (and is taken out
 * of rotation) instead of failing on the first page render. Never echoes values.
 */
export function GET(): Response {
  try {
    serverEnv();
  } catch (e) {
    log('error', 'invalid server environment', {
      reason: e instanceof Error ? e.message : 'unknown',
    });
    return Response.json({ status: 'misconfigured' }, { status: 503, headers: NO_STORE });
  }
  return Response.json({ status: 'ok' }, { headers: NO_STORE });
}
