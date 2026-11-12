import { COMMODITIES, MARKETS } from '@kawan-pasar/catalog';
import { cacheTags } from '@kawan-pasar/contracts';
import type { InvalidateScope } from '../../cache/cache.service.js';

/** Max tags per request; the web endpoint accepts at most 50. */
const CHUNK = 50;
const TIMEOUT_MS = 3000;

/**
 * Next.js cache tags affected by an API cache scope (tag names: @kawan-pasar/contracts cacheTags).
 * The price summary embeds the 7-day forecast, so forecasts also refresh `prices:<market>`.
 */
export function tagsForScope(scope: InvalidateScope): string[] {
  const markets = MARKETS.map((m) => m.code);
  const prices = markets.flatMap((m) => [
    cacheTags.prices(m),
    cacheTags.forecast(m),
    ...COMMODITIES.map((c) => cacheTags.history(m, c.code)),
  ]);
  const forecasts = markets.flatMap((m) => [cacheTags.forecast(m), cacheTags.prices(m)]);
  switch (scope) {
    case 'prices':
      return prices;
    case 'forecasts':
      return forecasts;
    case 'articles':
      return [cacheTags.articles];
    case 'all':
      return [cacheTags.markets, cacheTags.articles, ...prices];
  }
}

export interface WebTarget {
  url: string;
  token: string;
}

/**
 * Best-effort revalidation of the web server's data cache. Never throws: the API cache is
 * already invalidated, and the web cache falls back to its own revalidation interval.
 */
export class WebRevalidator {
  constructor(
    private readonly target: WebTarget | null,
    private readonly fetchFn: typeof fetch = fetch,
    private readonly warn: (message: string) => void = () => undefined,
  ) {}

  /** `true` when every chunk was accepted (or nothing is configured). */
  async revalidate(tags: readonly string[]): Promise<boolean> {
    if (this.target === null || tags.length === 0) return true;
    const endpoint = new URL('/api/internal/revalidate', this.target.url).href;
    let ok = true;
    for (let i = 0; i < tags.length; i += CHUNK) {
      try {
        const res = await this.fetchFn(endpoint, {
          method: 'POST',
          headers: { 'content-type': 'application/json', 'x-revalidate-token': this.target.token },
          body: JSON.stringify({ tags: tags.slice(i, i + CHUNK) }),
          signal: AbortSignal.timeout(TIMEOUT_MS),
        });
        if (!res.ok) {
          ok = false;
          this.warn(`web revalidation rejected with status ${String(res.status)}`);
        }
      } catch (e) {
        ok = false;
        this.warn(`web revalidation failed: ${e instanceof Error ? e.name : 'error'}`);
      }
    }
    return ok;
  }
}
