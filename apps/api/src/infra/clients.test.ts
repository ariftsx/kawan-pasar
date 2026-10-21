import { describe, expect, it, vi } from 'vitest';

import { pingValkey } from './clients.js';

import type { Redis } from 'ioredis';

function fakeValkey(status: string) {
  const client = {
    status,
    connect: vi.fn(() => Promise.resolve()),
    ping: vi.fn(() => Promise.resolve('PONG')),
  };
  return { client, redis: client as unknown as Redis };
}

describe('pingValkey', () => {
  it('opens a lazy connection before the first ping', async () => {
    const { client, redis } = fakeValkey('wait');
    await expect(pingValkey(redis)).resolves.toBe('PONG');
    expect(client.connect).toHaveBeenCalledOnce();
  });

  it('reuses an open connection', async () => {
    const { client, redis } = fakeValkey('ready');
    await pingValkey(redis);
    expect(client.connect).not.toHaveBeenCalled();
  });
});
