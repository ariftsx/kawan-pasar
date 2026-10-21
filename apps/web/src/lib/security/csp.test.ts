import { describe, expect, it } from 'vitest';

import { SECURITY_HEADERS, buildCsp, createNonce } from './csp';

describe('createNonce', () => {
  it('returns 128 random bits in base64, different every call', () => {
    const nonce = createNonce();
    expect(nonce).toMatch(/^[A-Za-z0-9+/]{22}==$/);
    expect(createNonce()).not.toBe(nonce);
  });
});

describe('buildCsp', () => {
  const production = buildCsp({ nonce: 'abc', isDev: false });

  it.each([
    "default-src 'self'",
    "script-src 'self' 'nonce-abc' 'strict-dynamic'",
    "style-src 'self' 'nonce-abc'",
    "object-src 'none'",
    "base-uri 'self'",
    "frame-ancestors 'none'",
    "form-action 'self' https://accounts.google.com",
    'upgrade-insecure-requests',
  ])('production policy contains %s', (directive) => {
    expect(production.split('; ')).toContain(directive);
  });

  it('never allows eval or inline scripts in production', () => {
    expect(production).not.toContain('unsafe-eval');
    expect(production).not.toMatch(/script-src[^;]*'unsafe-inline'/);
  });

  it('relaxes only what development needs', () => {
    const dev = buildCsp({ nonce: 'abc', isDev: true });
    expect(dev).toContain("'unsafe-eval'");
    expect(dev).not.toContain('upgrade-insecure-requests');
  });
});

describe('SECURITY_HEADERS', () => {
  it('matches docs 15 §10', () => {
    expect(SECURITY_HEADERS['Strict-Transport-Security']).toBe(
      'max-age=63072000; includeSubDomains; preload',
    );
    expect(SECURITY_HEADERS['X-Content-Type-Options']).toBe('nosniff');
    expect(SECURITY_HEADERS['Cross-Origin-Opener-Policy']).toBe('same-origin');
  });
});
