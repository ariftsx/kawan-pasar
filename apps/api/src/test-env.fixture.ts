import { parseEnv, type Env } from './config/env.js';

export const TEST_SERVICE_TOKEN = 'test-service-token-0123456789abcdef';

export function testEnv(overrides: Record<string, string> = {}): Env {
  return parseEnv({
    NODE_ENV: 'test',
    LOG_LEVEL: 'silent',
    SERVICE_TOKEN: TEST_SERVICE_TOKEN,
    // Port 1 refuses connections at once, so dependency checks fail fast in tests.
    DATABASE_URL: 'postgres://kp:test@127.0.0.1:1/kawan_pasar',
    VALKEY_CACHE_URL: 'redis://:test@127.0.0.1:1',
    VALKEY_QUEUE_URL: 'redis://:test@127.0.0.1:1',
    MODEL_URL: 'http://127.0.0.1:1',
    MODEL_HMAC_SECRET: 'test-model-hmac-secret-0123456789ab',
    ...overrides,
  });
}
