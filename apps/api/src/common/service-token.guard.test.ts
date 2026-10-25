import { Controller } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { describe, expect, it } from 'vitest';

import { TEST_SERVICE_TOKEN, testEnv } from '../test-env.fixture.js';
import { AppError } from './app-error.js';
import { Probe, ServiceTokenGuard } from './service-token.guard.js';

import type { ExecutionContext } from '@nestjs/common';

@Controller('protected')
class ProtectedRoutes {}

@Controller('probe')
@Probe()
class ProbeRoutes {}

/** Route body is irrelevant: the guard reads metadata from the class and the handler only. */
function handler(): void {
  // no-op
}

function contextFor(routes: abstract new () => object, headers: Record<string, unknown>) {
  return {
    getClass: () => routes,
    getHandler: () => handler,
    switchToHttp: () => ({ getRequest: () => ({ headers }) }),
  } as unknown as ExecutionContext;
}

const guard = new ServiceTokenGuard(testEnv(), new Reflector());

describe('ServiceTokenGuard', () => {
  it('admits the BFF with the configured token', () => {
    const context = contextFor(ProtectedRoutes, { 'x-service-token': TEST_SERVICE_TOKEN });
    expect(guard.canActivate(context)).toBe(true);
  });

  it.each([
    ['a missing header', {}],
    ['a wrong token', { 'x-service-token': 'wrong' }],
    ['a token with a suffix', { 'x-service-token': `${TEST_SERVICE_TOKEN}x` }],
    ['a repeated header', { 'x-service-token': [TEST_SERVICE_TOKEN, TEST_SERVICE_TOKEN] }],
  ])('rejects %s with UNAUTHENTICATED', (_label, headers) => {
    const attempt = () => guard.canActivate(contextFor(ProtectedRoutes, headers));
    expect(attempt).toThrow(AppError);
    expect(attempt).toThrow(expect.objectContaining({ code: 'UNAUTHENTICATED', status: 401 }));
  });

  it('lets orchestrator probes through without a token', () => {
    expect(guard.canActivate(contextFor(ProbeRoutes, {}))).toBe(true);
  });
});
