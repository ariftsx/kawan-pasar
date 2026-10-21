import { describe, expect, it } from 'vitest';

import { resolveRequestId } from './request-id.js';

import type { IncomingMessage } from 'node:http';

function request(header?: string | string[]): IncomingMessage {
  return { headers: header === undefined ? {} : { 'x-request-id': header } } as IncomingMessage;
}

describe('resolveRequestId', () => {
  it('keeps a safe upstream id from the BFF', () => {
    expect(resolveRequestId(request('req_01JABCDEFGHJKMNPQRSTVWXYZ0'))).toBe(
      'req_01JABCDEFGHJKMNPQRSTVWXYZ0',
    );
  });

  it.each([['line\nbreak'], ['x'.repeat(65)], [''], [['a', 'b']]])(
    'mints a new id instead of trusting %j',
    (header) => {
      expect(resolveRequestId(request(header))).toMatch(/^req_[0-9A-HJKMNP-TV-Z]{26}$/);
    },
  );

  it('returns the same id for the same request', () => {
    const raw = request();
    expect(resolveRequestId(raw)).toBe(resolveRequestId(raw));
  });
});
