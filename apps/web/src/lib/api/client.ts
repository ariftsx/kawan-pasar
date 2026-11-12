import 'server-only';
import { notFound } from 'next/navigation';
import type { z } from 'zod';
import { serverEnv } from '../env';
import { log } from '../log';

export type ApiResult<T> = { ok: true; data: T } | { ok: false; kind: 'not_found' | 'unavailable' };

export interface ApiGetOptions {
  /** Next.js data-cache tags (see tags.ts). */
  tags: readonly string[];
  /** Fallback revalidation in seconds; tag revalidation normally refreshes sooner. */
  revalidate: number;
}

/** Thrown by `requireData` so the error boundary renders and ISR keeps the last good page. */
export class UpstreamUnavailableError extends Error {
  constructor() {
    super('upstream unavailable');
    this.name = 'UpstreamUnavailableError';
  }
}

/**
 * Server-only GET against the Core API. The response is validated again with the shared contract
 * (double validation): a response that does not match is treated as unavailable. No retries on
 * the render path; failed fetches are not stored in the Next.js data cache.
 */
export async function apiGet<S extends z.ZodType>(
  path: string,
  schema: S,
  opts: ApiGetOptions,
): Promise<ApiResult<z.infer<S>>> {
  if (!path.startsWith('/') || path.startsWith('//')) {
    throw new Error('apiGet expects an absolute API path');
  }
  const env = serverEnv();
  const url = new URL(path, env.API_INTERNAL_URL);
  let res: Response;
  try {
    res = await fetch(url, {
      headers: { 'x-service-token': env.SERVICE_TOKEN, accept: 'application/json' },
      signal: AbortSignal.timeout(env.API_TIMEOUT_MS),
      cache: 'force-cache',
      next: { tags: [...opts.tags], revalidate: opts.revalidate },
    });
  } catch (e) {
    log('warn', 'api request failed', {
      path: url.pathname,
      reason: e instanceof Error ? e.name : 'unknown',
    });
    return { ok: false, kind: 'unavailable' };
  }
  if (res.status === 404) return { ok: false, kind: 'not_found' };
  if (!res.ok) {
    log('warn', 'api responded with an error', { path: url.pathname, status: res.status });
    return { ok: false, kind: 'unavailable' };
  }
  let body: unknown;
  try {
    body = await res.json();
  } catch {
    log('error', 'api response is not JSON', { path: url.pathname });
    return { ok: false, kind: 'unavailable' };
  }
  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    log('error', 'api response breaks the contract', {
      path: url.pathname,
      fields: [...new Set(parsed.error.issues.map((i) => i.path.join('.')))].slice(0, 10).join(','),
    });
    return { ok: false, kind: 'unavailable' };
  }
  return { ok: true, data: parsed.data };
}

/** Page helper: data or 404 page; unavailable throws (never cached by ISR). */
export function requireData<T>(result: ApiResult<T>): T {
  if (result.ok) return result.data;
  if (result.kind === 'not_found') notFound();
  throw new UpstreamUnavailableError();
}
