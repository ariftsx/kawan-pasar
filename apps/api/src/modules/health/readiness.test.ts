import { describe, expect, it } from 'vitest';

import { assessReadiness, type DependencyCheck } from './readiness.js';

const ok = (name: string, critical = false): DependencyCheck => ({
  name,
  critical,
  run: () => Promise.resolve(),
});
const failing = (name: string, critical = false): DependencyCheck => ({
  name,
  critical,
  run: () => Promise.reject(new Error('refused')),
});
const hanging = (name: string): DependencyCheck => ({
  name,
  critical: true,
  run: () => new Promise(() => undefined),
});

describe('assessReadiness', () => {
  it('is ok when every dependency answers', async () => {
    await expect(assessReadiness([ok('postgres', true), ok('model')])).resolves.toEqual({
      status: 'ok',
      checks: { postgres: 'ok', model: 'ok' },
    });
  });

  it('is degraded, not down, when only an optional dependency fails', async () => {
    await expect(assessReadiness([ok('postgres', true), failing('model')])).resolves.toEqual({
      status: 'degraded',
      checks: { postgres: 'ok', model: 'down' },
    });
  });

  it('is down when a critical dependency fails', async () => {
    const report = await assessReadiness([failing('postgres', true), ok('model')]);
    expect(report.status).toBe('down');
  });

  it('treats a check that outlives its timeout as down', async () => {
    const report = await assessReadiness([hanging('postgres')], 20);
    expect(report).toEqual({ status: 'down', checks: { postgres: 'down' } });
  });
});
