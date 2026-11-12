import { describe, expect, it, vi } from 'vitest';
import { notifyApiInvalidate } from '../../src/bundles/notify-api.js';

const TOKEN = 't'.repeat(40);

describe('notifyApiInvalidate', () => {
  it('asks the running API to invalidate (which also revalidates the web pages)', async () => {
    const fetchMock = vi.fn<typeof fetch>().mockResolvedValue(Response.json({ deleted: 0 }));
    await expect(
      notifyApiInvalidate('http://127.0.0.1:3001', TOKEN, 'forecasts', fetchMock),
    ).resolves.toBe(true);
    const [url, init] = fetchMock.mock.calls[0] ?? [];
    expect(url).toBe('http://127.0.0.1:3001/internal/cache/invalidate');
    expect(new Headers(init?.headers).get('x-service-token')).toBe(TOKEN);
    expect(init?.body).toBe('{"scope":"forecasts"}');
  });

  it('returns false instead of throwing when the API is not running', async () => {
    const fetchMock = vi.fn<typeof fetch>().mockRejectedValue(new TypeError('fetch failed'));
    await expect(
      notifyApiInvalidate('http://127.0.0.1:3001', TOKEN, 'forecasts', fetchMock),
    ).resolves.toBe(false);
  });
});
