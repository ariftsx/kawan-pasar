import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const revalidateTag = vi.fn();
vi.mock('next/cache', () => ({ revalidateTag }));

const TOKEN = 'r'.repeat(40);

beforeEach(() => {
  vi.stubEnv('API_INTERNAL_URL', 'http://api:3001');
  vi.stubEnv('SERVICE_TOKEN', 's'.repeat(40));
  vi.stubEnv('WEB_REVALIDATE_TOKEN', TOKEN);
  vi.spyOn(process.stderr, 'write').mockImplementation(() => true);
});

afterEach(() => {
  vi.unstubAllEnvs();
  vi.restoreAllMocks();
  revalidateTag.mockReset();
});

const call = async (body: string, token?: string): Promise<Response> => {
  const { POST } = await import('./route');
  return POST(
    new Request('http://web:3000/api/internal/revalidate', {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        ...(token === undefined ? {} : { 'x-revalidate-token': token }),
      },
      body,
    }),
  );
};

const valid = JSON.stringify({ tags: ['prices:PIKJ', 'history:PIKJ:bawang-merah'] });

describe('POST /api/internal/revalidate', () => {
  it('revalidates every tag with the stale-while-revalidate profile', async () => {
    const res = await call(valid, TOKEN);
    expect(res.status).toBe(204);
    expect(revalidateTag.mock.calls).toEqual([
      ['prices:PIKJ', 'max'],
      ['history:PIKJ:bawang-merah', 'max'],
    ]);
  });

  it('expires article tags at once (a withdrawn article must never be served again)', async () => {
    const res = await call(
      JSON.stringify({ tags: ['articles', 'article:apa-itu-inflasi'] }),
      TOKEN,
    );
    expect(res.status).toBe(204);
    expect(revalidateTag.mock.calls).toEqual([
      ['articles', { expire: 0 }],
      ['article:apa-itu-inflasi', { expire: 0 }],
    ]);
  });

  it('answers a missing and a wrong token identically', async () => {
    const missing = await call(valid);
    const wrong = await call(valid, 'x'.repeat(40));
    expect([missing.status, wrong.status]).toEqual([401, 401]);
    expect(await missing.text()).toBe(await wrong.text());
    expect(revalidateTag).not.toHaveBeenCalled();
  });

  it('rejects unknown tags and extra properties without echoing them', async () => {
    const res = await call(JSON.stringify({ tags: ['prices:PIKJ;<script>'] }), TOKEN);
    expect(res.status).toBe(400);
    expect(await res.text()).not.toContain('script');
    expect((await call(JSON.stringify({ tags: ['articles'], x: 1 }), TOKEN)).status).toBe(400);
    expect((await call(JSON.stringify({ tags: [] }), TOKEN)).status).toBe(400);
    expect((await call('not json', TOKEN)).status).toBe(400);
  });

  it('rejects a declared length over 8 KiB without reading the body', async () => {
    const { POST } = await import('./route');
    let pulled = 0;
    const body = new ReadableStream<Uint8Array>({
      pull(controller) {
        pulled += 1;
        controller.enqueue(new TextEncoder().encode('x'));
      },
    });
    // undici's Request drops a hand-set content-length; the server's request carries the real one.
    const request = {
      headers: new Headers({ 'x-revalidate-token': TOKEN, 'content-length': '9000' }),
      body,
    } as unknown as Request;
    const res = await POST(request);
    expect(res.status).toBe(413);
    expect(pulled).toBeLessThanOrEqual(1);
  });

  it('stops reading an endless body at 8 KiB', async () => {
    const { POST } = await import('./route');
    let sent = 0;
    const body = new ReadableStream<Uint8Array>({
      pull(controller) {
        sent += 1024;
        controller.enqueue(new Uint8Array(1024).fill(32));
      },
    });
    const res = await POST(
      new Request('http://web:3000/api/internal/revalidate', {
        method: 'POST',
        headers: { 'x-revalidate-token': TOKEN },
        body,
        duplex: 'half',
      } as RequestInit),
    );
    expect(res.status).toBe(413);
    expect(sent).toBeLessThan(16 * 1024);
  });

  it('rejects bodies larger than 8 KiB', async () => {
    const big = JSON.stringify({ tags: ['articles'], pad: 'x'.repeat(9000) });
    expect((await call(big, TOKEN)).status).toBe(413);
    expect(revalidateTag).not.toHaveBeenCalled();
  });
});
