import { describe, expect, it } from 'vitest';
import { summaryTtlSeconds } from '../../src/modules/prices/summary-ttl.js';

const DAY = 86_400_000;

describe('summaryTtlSeconds', () => {
  it('is one hour when no status boundary is near', () => {
    expect(summaryTtlSeconds(new Date('2026-11-11T03:00:00Z'), null)).toBe(3600);
  });

  it('ends at the next WIB midnight, when fresh data can turn stale', () => {
    // 23:50 WIB → 10 minutes to midnight
    expect(summaryTtlSeconds(new Date('2026-11-11T16:50:00Z'), null)).toBe(600);
  });

  it('ends when the active bundle crosses the 8-day (expired) boundary', () => {
    const now = new Date('2026-11-11T03:00:00Z');
    const issued = new Date(now.getTime() - 9 * DAY + 5 * 60_000); // turns 9 days old in 5 min
    expect(summaryTtlSeconds(now, issued)).toBe(300);
  });

  it('ends when the active bundle crosses the 28-day (hidden) boundary', () => {
    const now = new Date('2026-11-11T03:00:00Z');
    const issued = new Date(now.getTime() - 29 * DAY + 2 * 60_000);
    expect(summaryTtlSeconds(now, issued)).toBe(120);
  });

  it('is never below one second', () => {
    expect(summaryTtlSeconds(new Date('2026-11-11T16:59:59.900Z'), null)).toBe(1);
  });
});
