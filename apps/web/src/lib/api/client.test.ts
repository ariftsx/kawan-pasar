import { MarketsResponseSchema } from '@kawan-pasar/contracts';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { apiGet, requireData, UpstreamUnavailableError } from './client';

const TOKEN = 's'.repeat(40);
const markets = {
  items: [{ code: 'PIKJ', name: 'Pasar Kramat Jati', city: 'Jakarta Timur', status: 'available' }],
};

const fetchMock = vi.fn<typeof fetch>();
let logged: string[];

beforeEach(() => {
  vi.stubEnv('API_INTERNAL_URL', 'http://api:3001');
  vi.stubEnv('SERVICE_TOKEN', TOKEN);
  vi.stubEnv('WEB_REVALIDATE_TOKEN', 'r'.repeat(40));
  vi.stubGlobal('fetch', fetchMock);
  logged = [];
  vi.spyOn(process.stderr, 'write').mockImplementation((chunk: string | Uint8Array) => {
    logged.push(String(chunk));
    return true;
  });
});

afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
  fetchMock.mockReset();
});

const json = (body: unknown, status = 200): Response =>
  new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } });

const opts = { tags: ['markets'], revalidate: 60 };

describe('apiGet', () => {
  it('sends the service token and cache tags, and returns validated data', async () => {
    fetchMock.mockResolvedValue(json(markets));
    const r = await apiGet('/v1/markets', MarketsResponseSchema, opts);
    expect(r).toEqual({ ok: true, data: markets });
    const [url, init] = fetchMock.mock.calls[0] ?? [];
    expect(url instanceof URL ? url.href : url).toBe('http://api:3001/v1/markets');
    expect(new Headers(init?.headers).get('x-service-token')).toBe(TOKEN);
    expect(init).toMatchObject({
      cache: 'force-cache',
      next: { tags: ['markets'], revalidate: 60 },
    });
  });

  it('treats a response that breaks the contract as unavailable, without logging its body', async () => {
    fetchMock.mockResolvedValue(json({ items: [{ code: 'PIKJ', secret: 'leak-me' }] }));
    expect(await apiGet('/v1/markets', MarketsResponseSchema, opts)).toEqual({
      ok: false,
      kind: 'unavailable',
    });
    expect(logged.join('')).toContain('contract');
    expect(logged.join('')).not.toContain('leak-me');
    expect(logged.join('')).not.toContain(TOKEN);
  });

  it('maps 404 to not_found and 5xx to unavailable', async () => {
    fetchMock.mockResolvedValueOnce(json({ error: { code: 'not_found', message: 'x' } }, 404));
    expect(await apiGet('/v1/articles/x', MarketsResponseSchema, opts)).toEqual({
      ok: false,
      kind: 'not_found',
    });
    fetchMock.mockResolvedValueOnce(json({}, 503));
    expect((await apiGet('/v1/markets', MarketsResponseSchema, opts)).ok).toBe(false);
  });

  it('turns a timeout or network error into unavailable', async () => {
    fetchMock.mockRejectedValue(new DOMException('timed out', 'TimeoutError'));
    expect(await apiGet('/v1/markets', MarketsResponseSchema, opts)).toEqual({
      ok: false,
      kind: 'unavailable',
    });
  });

  it('only accepts absolute API paths', async () => {
    await expect(apiGet('http://evil/x', MarketsResponseSchema, opts)).rejects.toThrow();
  });
});

describe('requireData', () => {
  it('throws on unavailable so ISR never caches a failed render', () => {
    expect(() => requireData({ ok: false, kind: 'unavailable' })).toThrow(UpstreamUnavailableError);
    expect(requireData({ ok: true, data: 1 })).toBe(1);
  });
});
