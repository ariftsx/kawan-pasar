import { describe, expect, it } from 'vitest';

import { parseServerEnv } from './server';

describe('parseServerEnv', () => {
  it('accepts the internal API URL and the service token', () => {
    const env = parseServerEnv({
      API_INTERNAL_URL: 'http://api:4000',
      SERVICE_TOKEN: 't'.repeat(32),
    });
    expect(env.API_INTERNAL_URL).toBe('http://api:4000');
  });

  it('lists invalid keys without echoing the secret', () => {
    const attempt = () => parseServerEnv({ API_INTERNAL_URL: 'ftp://x', SERVICE_TOKEN: 'short' });
    expect(attempt).toThrow('Invalid server environment: API_INTERNAL_URL, SERVICE_TOKEN');
    expect(attempt).not.toThrow(/short/);
  });
});
