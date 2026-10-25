import { parseEnv, type Env } from './config/env.js';

export const TEST_SERVICE_TOKEN = 'test-service-token-0123456789abcdef';

export function testEnv(overrides: Record<string, string> = {}): Env {
  return parseEnv({
    NODE_ENV: 'test',
    LOG_LEVEL: 'silent',
    SERVICE_TOKEN: TEST_SERVICE_TOKEN,
    ...overrides,
  });
}
