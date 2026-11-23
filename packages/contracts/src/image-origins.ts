// Article image origins (Fase 3B, K2). No dependencies: also used by the web's CSP and proxy.

/** K2 (23 Nov 2026): images from these origins unless ARTICLE_IMAGE_ORIGINS says otherwise. */
export const DEFAULT_IMAGE_ORIGINS: readonly string[] = [
  'https://upload.wikimedia.org',
  'https://images.unsplash.com',
];

/**
 * Parses ARTICLE_IMAGE_ORIGINS (comma-separated). Each entry must be a bare https origin (no
 * path, no wildcard): it goes into the CSP img-src as is. Throws on anything else.
 */
export function parseImageOrigins(raw: string | undefined): readonly string[] {
  const entries = (raw ?? '')
    .split(',')
    .map((s) => s.trim())
    .filter((s) => s !== '');
  if (entries.length === 0) return DEFAULT_IMAGE_ORIGINS;
  return entries.map((e) => {
    const origin = httpsOrigin(e);
    if (origin === null) throw new Error(`ARTICLE_IMAGE_ORIGINS: "${e}" is not an https origin`);
    return origin;
  });
}

/** The entry itself when it is exactly an https origin (no path, query or trailing slash). */
function httpsOrigin(entry: string): string | null {
  try {
    const u = new URL(entry);
    return u.protocol === 'https:' && u.origin === entry ? u.origin : null;
  } catch {
    return null;
  }
}
