import type { FastifyRequest } from 'fastify';
import { describe, expect, it } from 'vitest';
import { rateLimitBucket } from '../../src/common/client-ip.js';

const req = (remoteAddress: string, xff?: string): FastifyRequest =>
  ({
    ip: xff ?? remoteAddress,
    socket: { remoteAddress },
    headers: xff === undefined ? {} : { 'x-forwarded-for': xff },
  }) as unknown as FastifyRequest;

const proxies = new Set(['172.30.0.10']);

describe('rateLimitBucket', () => {
  it('puts server-side requests from the trusted proxy in the internal bucket', () => {
    expect(rateLimitBucket(req('172.30.0.10'), proxies)).toEqual({ kind: 'internal' });
  });

  it('recognises the proxy when the socket reports an IPv4-mapped IPv6 address', () => {
    expect(rateLimitBucket(req('::ffff:172.30.0.10'), proxies)).toEqual({ kind: 'internal' });
  });

  it('counts forwarded visitors and untrusted callers per client', () => {
    expect(rateLimitBucket(req('172.30.0.10', '203.0.113.7'), proxies)).toEqual({
      kind: 'client',
      ip: '203.0.113.7',
    });
    expect(rateLimitBucket(req('::ffff:10.0.0.9'), proxies).kind).toBe('client');
  });
});
