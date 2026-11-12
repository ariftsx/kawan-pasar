import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const devValue = (name: string): string | undefined =>
  readFileSync(fileURLToPath(new URL('../../../../.env', import.meta.url)), 'utf8')
    .split(/\r?\n/)
    .find((l) => l.startsWith(`${name}=`))
    ?.slice(name.length + 1);

describe('test isolation', () => {
  it.each(['VALKEY_CACHE_URL', 'VALKEY_QUEUE_URL'])(
    'never shares %s with the development stack (tests would leave data in the dev cache)',
    (name) => {
      const dev = devValue(name);
      const test = process.env[name] ?? '';
      expect(dev).toBeDefined();
      expect(new URL(test).pathname).toBe('/15');
      expect(new URL(test).host).toBe(new URL(dev ?? '').host);
    },
  );
});
