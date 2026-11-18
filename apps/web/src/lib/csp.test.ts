import { describe, expect, it } from 'vitest';
import { buildCsp } from './csp';

describe('buildCsp', () => {
  const prod = buildCsp({ dev: false });

  it('never allows eval in production', () => {
    expect(prod).not.toContain('unsafe-eval');
    expect(buildCsp({ dev: true })).toContain("'unsafe-eval'");
  });

  it('forbids framing, plugins and base-tag hijacking', () => {
    expect(prod).toContain("frame-ancestors 'none'");
    expect(prod).toContain("object-src 'none'");
    expect(prod).toContain("base-uri 'none'");
  });

  it('limits inline script to the static RSC payload case and nothing else', () => {
    // ADR 0008: Next.js streams the RSC payload as inline scripts whose content changes per
    // page and per revalidation, so hashes cannot be precomputed for static pages.
    expect(prod).toContain("script-src 'self' 'unsafe-inline';");
    expect(prod).not.toContain('strict-dynamic');
  });

  it('allows no external origin at all', () => {
    expect(prod).not.toMatch(/https?:|\*/);
  });

  it('account pages (nonce): only scripts carrying the nonce, no inline allowance (ADR 0011)', () => {
    const csp = buildCsp({ dev: false, nonce: 'abc123' });
    expect(csp).toContain("script-src 'nonce-abc123' 'strict-dynamic';");
    expect(csp.split(';').find((d) => d.trim().startsWith('script-src'))).not.toContain(
      'unsafe-inline',
    );
    expect(csp).toContain("frame-ancestors 'none'");
    expect(csp).toContain("form-action 'self'");
  });
});
