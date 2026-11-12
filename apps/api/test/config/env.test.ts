import { describe, expect, it } from 'vitest';
import { EnvValidationError, loadEnv } from '../../src/config/env.js';

const SECRET_TOKEN = 'x'.repeat(40);

const valid = {
  NODE_ENV: 'test',
  DATABASE_URL: 'postgres://app_rw:pw@127.0.0.1:16432/kawanpasar',
  VALKEY_CACHE_URL: 'redis://:pw@127.0.0.1:16379/0',
  VALKEY_QUEUE_URL: 'redis://:pw@127.0.0.1:16380/0',
  SERVICE_TOKEN: SECRET_TOKEN,
};

describe('loadEnv', () => {
  it('parses a complete environment and applies defaults', () => {
    const env = loadEnv({ ...valid, API_PORT: '3005' });
    expect(env.API_PORT).toBe(3005);
    expect(env.DATABASE_POOL_MAX).toBe(10);
    expect(env.LOG_LEVEL).toBe('info');
  });

  it('names every invalid variable without echoing secret values', () => {
    const short = 'short-token';
    const { DATABASE_URL: _omitted, ...rest } = valid;
    let caught: unknown;
    try {
      loadEnv({ ...rest, SERVICE_TOKEN: short });
    } catch (e) {
      caught = e;
    }
    expect(caught).toBeInstanceOf(EnvValidationError);
    const message = (caught as EnvValidationError).message;
    expect(message).toContain('SERVICE_TOKEN');
    expect(message).toContain('DATABASE_URL');
    expect(message).not.toContain(short);
  });

  it('rejects a pool size above the PgBouncer-friendly limit', () => {
    expect(() => loadEnv({ ...valid, DATABASE_POOL_MAX: '500' })).toThrow(EnvValidationError);
  });

  it('rejects a database URL that is not postgres', () => {
    expect(() => loadEnv({ ...valid, DATABASE_URL: 'mysql://x@y/z' })).toThrow(/DATABASE_URL/);
  });

  it('requires the web revalidation URL and token together', () => {
    expect(() => loadEnv({ ...valid, WEB_INTERNAL_URL: 'http://web:3000' })).toThrow(
      /WEB_REVALIDATE_TOKEN/,
    );
    const env = loadEnv({
      ...valid,
      WEB_INTERNAL_URL: 'http://web:3000',
      WEB_REVALIDATE_TOKEN: 'w'.repeat(40),
    });
    expect(env.WEB_INTERNAL_URL).toBe('http://web:3000');
    expect(loadEnv(valid).RATE_LIMIT_INTERNAL_PER_MINUTE).toBe(1200);
  });
});
