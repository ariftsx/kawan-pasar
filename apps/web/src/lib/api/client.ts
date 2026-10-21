// Server-side client for the core API (docs 12 §5): service token + request id, 3 s timeout,
// and one retry for GET only. Errors are normalised to the docs 08 §8 envelope.
import 'server-only';

import type { ServerEnv } from '@/lib/env/server';

export const READ_TIMEOUT_MS = 3000;

export type ApiResult = { status: number; body: unknown; requestId: string };

/** Minted here when the browser request has none; api and model-svc log the same id. */
export function newRequestId(): string {
  return `req_${crypto.randomUUID().replaceAll('-', '')}`;
}

function unavailable(requestId: string): ApiResult {
  return {
    status: 503,
    requestId,
    body: {
      data: null,
      error: {
        code: 'DEPENDENCY_UNAVAILABLE',
        message: 'Layanan sedang tidak tersedia. Coba lagi sebentar lagi.',
        request_id: requestId,
      },
    },
  };
}

async function attempt(env: ServerEnv, path: string, requestId: string): Promise<ApiResult> {
  const response = await fetch(new URL(path, env.API_INTERNAL_URL), {
    headers: { 'x-service-token': env.SERVICE_TOKEN, 'x-request-id': requestId },
    signal: AbortSignal.timeout(READ_TIMEOUT_MS),
    cache: 'no-store',
  });
  const body: unknown = await response.json();
  return { status: response.status, body, requestId };
}

export async function apiGet(env: ServerEnv, path: string, requestId: string): Promise<ApiResult> {
  for (let tries = 0; tries < 2; tries += 1) {
    try {
      const result = await attempt(env, path, requestId);
      // Retry once on a transient upstream error; 4xx answers are final.
      if (result.status < 502 || tries === 1) return result;
    } catch {
      // Network failure or timeout: fall through to the retry, then report unavailable.
    }
  }
  return unavailable(requestId);
}
