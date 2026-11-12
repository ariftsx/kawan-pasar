import { describe, expect, it } from 'vitest';
import { parseServerEnv } from './env';

const good = {
  API_INTERNAL_URL: 'http://api:3001',
  SERVICE_TOKEN: 's'.repeat(40),
  WEB_REVALIDATE_TOKEN: 'r'.repeat(40),
};

describe('parseServerEnv', () => {
  it('accepts a complete environment and applies defaults', () => {
    expect(parseServerEnv(good)).toMatchObject({ API_TIMEOUT_MS: 3000 });
  });

  it('rejects a short service token without printing its value', () => {
    const secret = 'short-secret-value';
    expect(() => parseServerEnv({ ...good, SERVICE_TOKEN: secret })).toThrow(/SERVICE_TOKEN/);
    try {
      parseServerEnv({ ...good, SERVICE_TOKEN: secret });
    } catch (e) {
      expect(String(e)).not.toContain(secret);
    }
  });

  it('rejects a revalidation token equal to the service token', () => {
    expect(() => parseServerEnv({ ...good, WEB_REVALIDATE_TOKEN: good.SERVICE_TOKEN })).toThrow(
      /WEB_REVALIDATE_TOKEN/,
    );
  });

  it('rejects a non-http API URL', () => {
    expect(() => parseServerEnv({ ...good, API_INTERNAL_URL: 'file:///etc/passwd' })).toThrow(
      /API_INTERNAL_URL/,
    );
  });
});
