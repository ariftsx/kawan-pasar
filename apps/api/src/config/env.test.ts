import { describe, expect, it } from 'vitest';

import { parseEnv } from './env.js';

const TOKEN = 'a'.repeat(32);

describe('parseEnv', () => {
  it('applies defaults when only the service token is given', () => {
    expect(parseEnv({ SERVICE_TOKEN: TOKEN })).toEqual({
      NODE_ENV: 'development',
      HOST: '0.0.0.0',
      PORT: 4000,
      LOG_LEVEL: 'info',
      SERVICE_TOKEN: TOKEN,
      TRUSTED_PROXY_CIDRS: ['10.0.0.0/8'],
    });
  });

  it('parses the port and a comma-separated CIDR list', () => {
    const env = parseEnv({
      SERVICE_TOKEN: TOKEN,
      PORT: '8080',
      TRUSTED_PROXY_CIDRS: ' 10.0.0.0/8, 172.16.0.0/12 ,fd00::/8',
    });
    expect(env.PORT).toBe(8080);
    expect(env.TRUSTED_PROXY_CIDRS).toEqual(['10.0.0.0/8', '172.16.0.0/12', 'fd00::/8']);
  });

  it('ignores unrelated variables from process.env', () => {
    expect(() => parseEnv({ SERVICE_TOKEN: TOKEN, PATH: '/usr/bin' })).not.toThrow();
  });

  it('lists every invalid key without echoing secret values', () => {
    const attempt = () =>
      parseEnv({ SERVICE_TOKEN: 'short-secret', PORT: '70000', TRUSTED_PROXY_CIDRS: '*' });
    expect(attempt).toThrow('Invalid server environment: PORT, SERVICE_TOKEN, TRUSTED_PROXY_CIDRS');
    expect(attempt).not.toThrow(/short-secret/);
  });

  it('requires the service token', () => {
    expect(() => parseEnv({})).toThrow('SERVICE_TOKEN');
  });

  it('rejects an empty proxy list instead of trusting nobody silently', () => {
    expect(() => parseEnv({ SERVICE_TOKEN: TOKEN, TRUSTED_PROXY_CIDRS: ' , ' })).toThrow(
      'TRUSTED_PROXY_CIDRS',
    );
  });
});
