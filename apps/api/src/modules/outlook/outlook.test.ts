import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from 'vitest';

import { createApp } from '../../app.factory.js';
import { TEST_SERVICE_TOKEN, testEnv } from '../../test-env.fixture.js';

import type { NestFastifyApplication } from '@nestjs/platform-fastify';

/** The shape services/model returns for /internal/forecasts in development mode. */
const MODEL_ANSWER = {
  data: {
    run: {
      id: 'fr_01JADEM0000000000000000001',
      commodity: 'cabai-merah-keriting',
      market: 'PIKJ',
      origin: '2026-10-18',
      model_version: 'demo',
      dataset_version: 'demo',
      preprocessing_version: 'demo',
      data_cutoff: '2026-10-18T12:00:00+07:00',
      status: 'generated',
    },
    reference_price_idr: 52400,
    points: [
      {
        horizon_day: 1,
        target_date: '2026-10-19',
        predicted_change: 0.0106,
        predicted_price_idr: 52955,
      },
      {
        horizon_day: 7,
        target_date: '2026-10-25',
        predicted_change: 0.028,
        predicted_price_idr: 53867,
      },
    ],
  },
  provenance: {
    model_version: 'demo',
    dataset_version: 'demo',
    preprocessing_version: 'demo',
    data_cutoff: '2026-10-18T12:00:00+07:00',
    artifact_status: 'draft',
  },
  availability: {
    price: 'available',
    climate: 'missing',
    news: 'missing',
    macro_logistics: 'missing',
    calendar: 'missing',
  },
  limitations: ['DATA DEMO — bukan hasil model.'],
  outlook_status: 'in_development',
  error: null,
};

let app: NestFastifyApplication;

beforeAll(async () => {
  app = await createApp(testEnv());
  await app.init();
  await app.getHttpAdapter().getInstance().ready();
});

afterAll(async () => {
  await app.close();
});

afterEach(() => {
  vi.unstubAllGlobals();
});

function modelAnswers(body: unknown) {
  vi.stubGlobal(
    'fetch',
    vi.fn(() => Promise.resolve(Response.json(body))),
  );
}

const get = (url: string) =>
  app
    .getHttpAdapter()
    .getInstance()
    .inject({ method: 'GET', url, headers: { 'x-service-token': TEST_SERVICE_TOKEN } });

describe('GET /v1/outlook/:slug', () => {
  it('wraps the model forecast in the docs 08 §3 envelope', async () => {
    modelAnswers(MODEL_ANSWER);
    const response = await get('/v1/outlook/cabai-merah-keriting');
    expect(response.statusCode).toBe(200);
    const body = response.json<Record<string, unknown>>();
    expect(body).toMatchObject({
      data: { status: 'in_development', forecast: MODEL_ANSWER.data },
      provenance: { model_version: 'demo', artifact_status: 'draft' },
      limitations: ['DATA DEMO — bukan hasil model.'],
      error: null,
    });
    expect(body.meta).toMatchObject({
      request_id: response.headers['x-request-id'],
      schema_version: '1.0.0',
    });
  });

  it('keeps only the requested horizon', async () => {
    modelAnswers(MODEL_ANSWER);
    const response = await get('/v1/outlook/cabai-merah-keriting?horizon=7');
    const points = response.json<{ data: { forecast: { points: { horizon_day: number }[] } } }>()
      .data.forecast.points;
    expect(points.map((point) => point.horizon_day)).toEqual([7]);
  });

  it.each([
    [
      'an unsupported horizon',
      '/v1/outlook/cabai-merah-keriting?horizon=5',
      400,
      'INVALID_HORIZON',
    ],
    ['a malformed slug', '/v1/outlook/Cabai_Merah', 404, 'NOT_FOUND'],
  ])('rejects %s before calling the model', async (_label, url, status, code) => {
    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);
    const response = await get(url);
    expect(response.statusCode).toBe(status);
    expect(response.json<{ error: { code: string } }>().error.code).toBe(code);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('never forwards a model answer that breaks the contract', async () => {
    modelAnswers({ ...MODEL_ANSWER, provenance: { model_version: 'demo' } });
    const response = await get('/v1/outlook/cabai-merah-keriting');
    expect(response.statusCode).toBe(422);
    expect(response.json<{ error: { code: string } }>().error.code).toBe('MODEL_INCOMPATIBLE');
  });

  it('requires the service token', async () => {
    const response = await app
      .getHttpAdapter()
      .getInstance()
      .inject({ method: 'GET', url: '/v1/outlook/cabai-merah-keriting' });
    expect(response.statusCode).toBe(401);
  });
});
