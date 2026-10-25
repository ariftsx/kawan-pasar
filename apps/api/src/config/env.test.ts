import { describe, expect, it } from 'vitest';

import { parseEnv } from './env.js';

const TOKEN = 'a'.repeat(32);
const REQUIRED = {
  SERVICE_TOKEN: TOKEN,
  DATABASE_URL: 'postgres://kp:pw@postgres:5432/kawan_pasar',
  VALKEY_CACHE_URL: 'redis://:pw@valkey-cache:6379',
  VALKEY_QUEUE_URL: 'redis://:pw@valkey-queue:6379',
  MODEL_URL: 'http://model:8000',
  MODEL_HMAC_SECRET: 'b'.repeat(32),
};

describe('parseEnv', () => {
  it('applies defaults when only the required keys are given', () => {
    expect(parseEnv(REQUIRED)).toEqual({
      ...REQUIRED,
      NODE_ENV: 'development',
      HOST: '0.0.0.0',
      PORT: 4000,
      LOG_LEVEL: 'info',
      TRUSTED_PROXY_CIDRS: ['10.0.0.0/8'],
    });
  });

  it('parses the port and a comma-separated CIDR list', () => {
    const env = parseEnv({
      ...REQUIRED,
      PORT: '8080',
      TRUSTED_PROXY_CIDRS: ' 10.0.0.0/8, 172.16.0.0/12 ,fd00::/8',
    });
    expect(env.PORT).toBe(8080);
    expect(env.TRUSTED_PROXY_CIDRS).toEqual(['10.0.0.0/8', '172.16.0.0/12', 'fd00::/8']);
  });

  it('ignores unrelated variables from process.env', () => {
    expect(() => parseEnv({ ...REQUIRED, PATH: '/usr/bin' })).not.toThrow();
  });

  it('lists every invalid key without echoing secret values', () => {
    const attempt = () =>
      parseEnv({
        ...REQUIRED,
        SERVICE_TOKEN: 'short-secret',
        PORT: '70000',
        TRUSTED_PROXY_CIDRS: '*',
      });
    expect(attempt).toThrow('Invalid server environment: PORT, SERVICE_TOKEN, TRUSTED_PROXY_CIDRS');
    expect(attempt).not.toThrow(/short-secret/);
  });

  it('requires the service token', () => {
    expect(() => parseEnv({ ...REQUIRED, SERVICE_TOKEN: undefined })).toThrow('SERVICE_TOKEN');
  });

  it('accepts only the expected URL schemes for dependencies', () => {
    expect(() => parseEnv({ ...REQUIRED, DATABASE_URL: 'mysql://db/x' })).toThrow('DATABASE_URL');
    expect(() => parseEnv({ ...REQUIRED, MODEL_URL: 'file:///etc/passwd' })).toThrow('MODEL_URL');
  });

  it('rejects an empty proxy list instead of trusting nobody silently', () => {
    expect(() => parseEnv({ ...REQUIRED, TRUSTED_PROXY_CIDRS: ' , ' })).toThrow(
      'TRUSTED_PROXY_CIDRS',
    );
  });
});
