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
});
