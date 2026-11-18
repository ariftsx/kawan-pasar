import { setTimeout as delay } from 'node:timers/promises';
import { describe, expect, it } from 'vitest';
import { HashGate, HashGateFull } from '../../src/modules/auth/hash-gate.js';

describe('HashGate (bounded Argon2 concurrency)', () => {
  it('never runs more than `concurrency` jobs at once, and runs them all', async () => {
    const gate = new HashGate({ concurrency: 2, maxQueue: 10, maxWaitMs: 5_000 });
    let running = 0;
    let peak = 0;
    const job = async (): Promise<number> => {
      running += 1;
      peak = Math.max(peak, running);
      await delay(20);
      running -= 1;
      return 1;
    };
    const results = await Promise.all(Array.from({ length: 8 }, () => gate.run(job)));
    expect(results).toHaveLength(8);
    expect(peak).toBe(2);
  });

  it('refuses at once when the waiting line is full (cheap answer under a flood)', async () => {
    const gate = new HashGate({ concurrency: 1, maxQueue: 2, maxWaitMs: 5_000 });
    const slow = (): Promise<void> => delay(100);
    const accepted = [gate.run(slow), gate.run(slow), gate.run(slow)];
    const started = performance.now();
    await expect(gate.run(slow)).rejects.toBeInstanceOf(HashGateFull);
    expect(performance.now() - started).toBeLessThan(20);
    await Promise.all(accepted);
  });

  it('gives up on a job that waited too long', async () => {
    const gate = new HashGate({ concurrency: 1, maxQueue: 5, maxWaitMs: 30 });
    const busy = gate.run(() => delay(200));
    await expect(gate.run(() => delay(1))).rejects.toBeInstanceOf(HashGateFull);
    await busy;
  });

  it('frees its slot when a job throws', async () => {
    const gate = new HashGate({ concurrency: 1, maxQueue: 5, maxWaitMs: 1_000 });
    await expect(gate.run(() => Promise.reject(new Error('boom')))).rejects.toThrow('boom');
    await expect(gate.run(() => Promise.resolve('ok'))).resolves.toBe('ok');
  });
});
