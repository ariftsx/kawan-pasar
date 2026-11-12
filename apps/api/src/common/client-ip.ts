import type { FastifyRequest } from 'fastify';

/**
 * The client address. Fastify resolves `request.ip` through `trustProxy`, which only trusts the
 * configured proxy addresses (TRUSTED_PROXY_IPS), so a direct caller cannot spoof it with
 * X-Forwarded-For.
 */
export function clientIp(request: FastifyRequest): string {
  return request.ip;
}

export type RateLimitBucket = { kind: 'internal' } | { kind: 'client'; ip: string };

/**
 * Requests that the trusted proxy (the web server) makes on its own behalf (server rendering,
 * revalidation) carry no X-Forwarded-For. They share one "internal" bucket instead of competing
 * with visitors. Only the socket peer decides this, so an outside caller can never reach it.
 */
export function rateLimitBucket(
  request: FastifyRequest,
  trustedProxies: ReadonlySet<string>,
): RateLimitBucket {
  // A dual-stack listener reports IPv4 peers as IPv4-mapped IPv6 (::ffff:a.b.c.d).
  const peer = (request.socket.remoteAddress ?? '').replace(/^::ffff:/i, '');
  if (trustedProxies.has(peer) && request.headers['x-forwarded-for'] === undefined) {
    return { kind: 'internal' };
  }
  return { kind: 'client', ip: clientIp(request) };
}
