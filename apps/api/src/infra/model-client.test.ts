import { afterEach, describe, expect, it, vi } from 'vitest';

import { testEnv } from '../test-env.fixture.js';
import { ModelClient, signModelRequest } from './model-client.js';

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('signModelRequest', () => {
  // Vectors produced by services/model app.core.security.sign: both services must agree.
  it.each([
    [
      'GET',
      '/internal/forecasts/cabai-merah-keriting?origin=2026-10-18',
      '',
      'ebc2fd6247ac9dc90920dd78f60c6190a30b166a52e2e3c70e6531a83e1e95f9',
    ],
    [
      'post',
      '/internal/artifacts/reload',
      '{"a":1}',
      'd452a3607c06a86551cccdc732f3bd4d1cbe3c349f3c0a8bc2d1cfc4083d3281',
    ],
  ])('matches the Python signer for %s %s', (method, target, body, expected) => {
    expect(signModelRequest('k'.repeat(32), '1800000000', method, target, body)).toBe(expected);
  });
});

function stubFetch(response: Response | Error) {
  const fetchMock = vi.fn<(url: URL, init: RequestInit) => Promise<Response>>(() =>
    response instanceof Error ? Promise.reject(response) : Promise.resolve(response),
  );
  vi.stubGlobal('fetch', fetchMock);
  return fetchMock;
}

const errorBody = (code: string) =>
  Response.json(
    { data: null, error: { code, message: 'Pesan dari model.', request_id: 'req_x' } },
    { status: 503 },
  );

describe('ModelClient', () => {
  const client = new ModelClient(testEnv({ MODEL_URL: 'http://model:8000' }));

  it('sends a signed GET with the request id and returns the body', async () => {
    const fetchMock = stubFetch(Response.json({ ok: true }));
    await expect(client.get('/internal/artifacts/manifest', 'req_abc')).resolves.toEqual({
      ok: true,
    });
    const [url, init] = fetchMock.mock.calls[0] ?? [];
    expect(String(url)).toBe('http://model:8000/internal/artifacts/manifest');
    const headers = new Headers(init?.headers);
    expect(headers.get('x-request-id')).toBe('req_abc');
    expect(headers.get('x-kp-signature')).toMatch(/^[0-9a-f]{64}$/);
    expect(Number(headers.get('x-kp-timestamp'))).toBeGreaterThan(1_700_000_000);
  });

  it('passes a contract error from the model through', async () => {
    stubFetch(errorBody('FORECAST_UNAVAILABLE'));
    await expect(client.get('/internal/forecasts/x', 'req_abc')).rejects.toMatchObject({
      code: 'FORECAST_UNAVAILABLE',
      message: 'Pesan dari model.',
    });
  });

  it.each([
    ['a rejected signature', errorBody('UNAUTHENTICATED')],
    ['a body that is not an envelope', new Response('<html>', { status: 502 })],
    ['a network failure', new TypeError('fetch failed')],
  ])('reports %s as MODEL_UNAVAILABLE', async (_label, response) => {
    stubFetch(response);
    await expect(client.get('/internal/forecasts/x', 'req_abc')).rejects.toMatchObject({
      code: 'MODEL_UNAVAILABLE',
      status: 503,
    });
  });
});
