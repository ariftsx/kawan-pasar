import type { FastifyRequest } from 'fastify';

/**
 * The client address. Fastify resolves `request.ip` through `trustProxy`, which only trusts the
 * configured proxy addresses (TRUSTED_PROXY_IPS), so a direct caller cannot spoof it with
 * X-Forwarded-For.
 */
export function clientIp(request: FastifyRequest): string {
  return request.ip;
}
