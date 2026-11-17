import { parseCacheTag } from '@kawan-pasar/contracts';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { WebRevalidator, tagsForScope } from '../../src/modules/internal/web-revalidator.js';

const URL_ = 'http://web:3000';
const TOKEN = 'w'.repeat(40);
const urlOf = (input: string | URL | Request): string =>
  typeof input === 'string' ? input : input instanceof URL ? input.href : input.url;

afterEach(() => {
  vi.restoreAllMocks();
});

describe('tagsForScope', () => {
  it('covers summary, history and forecast pages of every market after a price import', () => {
    const tags = tagsForScope('prices');
    expect(tags).toContain('prices:PIKJ');
    expect(tags).toContain('forecast:PIKJ');
    expect(tags).toContain('history:PIKJ:bawang-merah');
    expect(tags).toContain('history:PIKJ:cabai-rawit-hijau');
  });

  it('refreshes forecasts and the summary (which embeds the 7-day forecast) after a promotion', () => {
    expect(tagsForScope('forecasts')).toEqual(
      expect.arrayContaining(['forecast:PIKJ', 'prices:PIKJ']),
    );
    expect(tagsForScope('forecasts')).not.toContain('articles');
  });

  it('only produces tags the web endpoint accepts', () => {
    for (const scope of ['prices', 'forecasts', 'articles', 'all'] as const) {
      expect(tagsForScope(scope).filter((t) => parseCacheTag(t) === null)).toEqual([]);
    }
  });

  it('maps articles and all', () => {
    expect(tagsForScope('articles')).toEqual(['articles']);
    expect(tagsForScope('all')).toEqual(
      expect.arrayContaining(['markets', 'articles', 'prices:PIKJ']),
    );
  });
});

describe('WebRevalidator', () => {
  it('posts the tags with its own token, in chunks of at most 50', async () => {
    const fetchMock = vi.fn<typeof fetch>().mockResolvedValue(new Response(null, { status: 204 }));
    const r = new WebRevalidator({ urls: [URL_], token: TOKEN }, fetchMock, () => undefined);
    const tags = Array.from({ length: 60 }, (_, i) => `article:a${String(i)}`);
    await r.revalidate(tags);
    expect(fetchMock).toHaveBeenCalledTimes(2);
    const [url, init] = fetchMock.mock.calls[0] ?? [];
    expect(url).toBe('http://web:3000/api/internal/revalidate');
    expect(new Headers(init?.headers).get('x-revalidate-token')).toBe(TOKEN);
    expect(JSON.parse(typeof init?.body === 'string' ? init.body : '')).toEqual({
      tags: tags.slice(0, 50),
    });
  });

  it('never throws when the web server is down, and warns', async () => {
    const warn = vi.fn();
    const fetchMock = vi.fn<typeof fetch>().mockRejectedValue(new TypeError('fetch failed'));
    const r = new WebRevalidator({ urls: [URL_], token: TOKEN }, fetchMock, warn);
    await expect(r.revalidate(['articles'])).resolves.toBe(false);
    expect(warn).toHaveBeenCalledTimes(1);
  });

  it('reports a rejected request as a failure', async () => {
    const fetchMock = vi.fn<typeof fetch>().mockResolvedValue(new Response(null, { status: 401 }));
    const r = new WebRevalidator({ urls: [URL_], token: TOKEN }, fetchMock, () => undefined);
    await expect(r.revalidate(['articles'])).resolves.toBe(false);
  });

  it('revalidates every replica, and one replica down does not stop the others', async () => {
    const warn = vi.fn();
    const fetchMock = vi.fn<typeof fetch>((input) =>
      urlOf(input).startsWith('http://web-1')
        ? Promise.reject(new TypeError('fetch failed'))
        : Promise.resolve(new Response(null, { status: 204 })),
    );
    const r = new WebRevalidator(
      { urls: ['http://web-1:3000', 'http://web-2:3000'], token: TOKEN },
      fetchMock,
      warn,
    );
    await expect(r.revalidate(['articles'])).resolves.toBe(false);
    expect(fetchMock.mock.calls.map(([u]) => urlOf(u))).toEqual([
      'http://web-1:3000/api/internal/revalidate',
      'http://web-2:3000/api/internal/revalidate',
    ]);
    expect(warn).toHaveBeenCalledTimes(1);
    expect(String(warn.mock.calls[0]?.[0])).toContain('web-1:3000');
  });

  it('does nothing when no web server is configured', async () => {
    const fetchMock = vi.fn<typeof fetch>();
    const r = new WebRevalidator(null, fetchMock, () => undefined);
    await expect(r.revalidate(['articles'])).resolves.toBe(true);
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
