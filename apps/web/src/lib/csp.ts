/**
 * Content-Security-Policy for the statically rendered public pages (ADR 0008, "hybrid").
 * No nonce: pages are static/ISR, so every visitor gets the same HTML. Script files may only
 * come from our own origin (with SRI); no third-party origin is allowed anywhere. Pages that
 * render per request (accounts, Fase 2) get a nonce-based policy instead.
 */
export function buildCsp({
  dev,
  nonce,
  imageOrigins = [],
}: {
  dev: boolean;
  nonce?: string;
  /** Fase 3B (K2): https origins article images may come from (ARTICLE_IMAGE_ORIGINS). */
  imageOrigins?: readonly string[];
}): string {
  // Account pages (ADR 0011): rendered per request, so every Next.js script carries the nonce.
  const scripts =
    nonce === undefined ? ["'self'", "'unsafe-inline'"] : [`'nonce-${nonce}'`, "'strict-dynamic'"];
  const directives: Record<string, string[]> = {
    'default-src': ["'self'"],
    // 'unsafe-inline' only because the RSC payload of static pages is inline and changes per
    // page/revalidation (no stable hash, no per-request nonce). External scripts carry SRI.
    'script-src': [...scripts, ...(dev ? ["'unsafe-eval'"] : [])],
    // React/Next inject inline style attributes; styles cannot execute code.
    'style-src': ["'self'", "'unsafe-inline'"],
    'img-src': ["'self'", 'data:', ...imageOrigins],
    'font-src': ["'self'"],
    'connect-src': ["'self'", ...(dev ? ['ws:'] : [])],
    'object-src': ["'none'"],
    'base-uri': ["'none'"],
    'form-action': ["'self'"],
    'frame-ancestors': ["'none'"],
    'manifest-src': ["'self'"],
    'worker-src': ["'self'"],
  };
  return Object.entries(directives)
    .map(([k, v]) => `${k} ${v.join(' ')}`)
    .join('; ');
}
