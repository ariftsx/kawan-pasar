import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

beforeEach(() => {
  vi.resetModules();
  vi.spyOn(process.stderr, 'write').mockImplementation(() => true);
});

afterEach(() => {
  vi.unstubAllEnvs();
  vi.restoreAllMocks();
});

const health = async (): Promise<Response> => {
  const { GET } = await import('./route');
  return GET();
};

describe('GET /api/health', () => {
  it('is healthy with a valid server environment', async () => {
    vi.stubEnv('API_INTERNAL_URL', 'http://api:3001');
    vi.stubEnv('SERVICE_TOKEN', 's'.repeat(40));
    vi.stubEnv('WEB_REVALIDATE_TOKEN', 'r'.repeat(40));
    const res = await health();
    expect(res.status).toBe(200);
    expect(res.headers.get('cache-control')).toBe('no-store');
  });

  it('is unhealthy right after start when the environment is invalid, naming no values', async () => {
    vi.stubEnv('API_INTERNAL_URL', 'not a url');
    vi.stubEnv('SERVICE_TOKEN', 'short-secret');
    vi.stubEnv('WEB_REVALIDATE_TOKEN', 'r'.repeat(40));
    const res = await health();
    expect(res.status).toBe(503);
    const body = await res.text();
    expect(body).not.toContain('short-secret');
    expect(body).not.toContain('not a url');
  });
});
