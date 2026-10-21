import { describe, expect, it } from 'vitest';

import { parsePublicEnv } from './public';

describe('parsePublicEnv', () => {
  it('accepts a valid public environment', () => {
    expect(
      parsePublicEnv({
        NEXT_PUBLIC_APP_URL: 'https://kawanpasar.test',
        NEXT_PUBLIC_DATA_MODE: 'demo',
      }),
    ).toEqual({ NEXT_PUBLIC_APP_URL: 'https://kawanpasar.test', NEXT_PUBLIC_DATA_MODE: 'demo' });
  });

  it('lists every invalid key and ignores unrelated variables', () => {
    expect(() =>
      parsePublicEnv({
        NEXT_PUBLIC_APP_URL: 'ftp://x',
        NEXT_PUBLIC_DATA_MODE: 'prod',
        SECRET: 's',
      }),
    ).toThrow('Invalid public environment: NEXT_PUBLIC_APP_URL, NEXT_PUBLIC_DATA_MODE');
  });
});
