import { describe, expect, it } from 'vitest';
import { ThrottledWarning } from '../../src/common/throttled-log.js';

describe('ThrottledWarning', () => {
  it('emits at most one warning per key per interval and reports suppressed repeats', () => {
    let t = 0;
    const out: string[] = [];
    const warn = new ThrottledWarning(
      10_000,
      (m) => out.push(m),
      () => t,
    );
    warn.warn('cache', 'cache down');
    warn.warn('cache', 'cache down');
    warn.warn('cache', 'cache down');
    t = 10_001;
    warn.warn('cache', 'cache down');
    expect(out).toEqual(['cache down', 'cache down (2 similar warnings suppressed)']);
  });

  it('throttles keys independently', () => {
    const out: string[] = [];
    const warn = new ThrottledWarning(
      10_000,
      (m) => out.push(m),
      () => 0,
    );
    warn.warn('a', 'A');
    warn.warn('b', 'B');
    expect(out).toEqual(['A', 'B']);
  });
});
