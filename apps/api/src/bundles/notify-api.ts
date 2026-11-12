import type { InvalidateScope } from '../cache/cache.service.js';

/**
 * Host-side CLIs cannot reach the web server's internal endpoint, so after a promotion they ask
 * the running API to invalidate: the API then revalidates the web pages (WebRevalidator).
 * Best effort: `false` when the API is not reachable (TTLs bound the staleness).
 */
export async function notifyApiInvalidate(
  apiUrl: string,
  serviceToken: string,
  scope: InvalidateScope,
  fetchFn: typeof fetch = fetch,
): Promise<boolean> {
  try {
    const res = await fetchFn(new URL('/internal/cache/invalidate', apiUrl).href, {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'x-service-token': serviceToken },
      body: JSON.stringify({ scope }),
      // Longer than the API's own wait for the web server (3 s), so a slow web server is not
      // misreported as "API not reachable".
      signal: AbortSignal.timeout(8000),
    });
    return res.ok;
  } catch {
    return false;
  }
}
