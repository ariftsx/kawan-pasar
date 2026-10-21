import { afterEach, describe, expect, it, vi } from 'vitest';

import { apiGet, newRequestId } from './client';

const ENV = { API_INTERNAL_URL: 'http://api:4000', SERVICE_TOKEN: 't'.repeat(32) };

afterEach(() => {
  vi.unstubAllGlobals();
});

function stubFetch(...answers: (Response | Error)[]) {
  const fetchMock = vi.fn<(url: URL, init: RequestInit) => Promise<Response>>();
  for (const answer of answers) {
    fetchMock.mockImplementationOnce(() =>
      answer instanceof Error ? Promise.reject(answer) : Promise.resolve(answer),
    );
  }
  vi.stubGlobal('fetch', fetchMock);
  return fetchMock;
}

describe('apiGet', () => {
  it('sends the service token and request id to the internal API', async () => {
    const fetchMock = stubFetch(Response.json({ data: 1 }));
    const result = await apiGet(ENV, '/v1/outlook/bawang-merah', 'req_abc');
    expect(result).toEqual({ status: 200, body: { data: 1 }, requestId: 'req_abc' });
    const [url, init] = fetchMock.mock.calls[0] ?? [];
    expect(String(url)).toBe('http://api:4000/v1/outlook/bawang-merah');
    const headers = new Headers(init?.headers);
    expect(headers.get('x-service-token')).toBe(ENV.SERVICE_TOKEN);
    expect(headers.get('x-request-id')).toBe('req_abc');
  });

  it('returns a 4xx answer as final, without retrying', async () => {
    const fetchMock = stubFetch(Response.json({ error: { code: 'NOT_FOUND' } }, { status: 404 }));
    const result = await apiGet(ENV, '/v1/outlook/x', 'req_abc');
    expect(result.status).toBe(404);
    expect(fetchMock).toHaveBeenCalledOnce();
  });

  it('retries a GET once after a transient failure', async () => {
    const fetchMock = stubFetch(new TypeError('fetch failed'), Response.json({ data: 2 }));
    await expect(apiGet(ENV, '/v1/outlook/x', 'req_abc')).resolves.toMatchObject({ status: 200 });
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it('keeps the second 5xx answer from the API', async () => {
    stubFetch(Response.json({}, { status: 503 }), Response.json({ error: 'x' }, { status: 503 }));
    await expect(apiGet(ENV, '/v1/outlook/x', 'req_abc')).resolves.toMatchObject({ status: 503 });
  });

  it('reports DEPENDENCY_UNAVAILABLE when the API cannot be reached', async () => {
    stubFetch(new TypeError('fetch failed'), new TypeError('fetch failed'));
    const result = await apiGet(ENV, '/v1/outlook/x', 'req_abc');
    expect(result.status).toBe(503);
    expect(result.body).toMatchObject({
      error: { code: 'DEPENDENCY_UNAVAILABLE', request_id: 'req_abc' },
    });
  });
});

describe('newRequestId', () => {
  it('matches the id format api and model-svc accept', () => {
    expect(newRequestId()).toMatch(/^req_[0-9a-f]{32}$/);
  });
});
