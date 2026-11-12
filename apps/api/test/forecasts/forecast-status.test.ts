import { describe, expect, it } from 'vitest';
import { ageDays, forecastStatus } from '../../src/modules/forecasts/forecast-status.js';

const now = new Date('2026-11-11T10:00:00+07:00');
const issuedDaysAgo = (days: number): Date => new Date(now.getTime() - days * 86_400_000);

describe('forecastStatus', () => {
  it('is pending_coverage for commodities outside the model, even with an active bundle', () => {
    expect(forecastStatus('pending', { issuedAt: issuedDaysAgo(1) }, now)).toBe('pending_coverage');
  });

  it('is unavailable without an active bundle', () => {
    expect(forecastStatus('covered', null, now)).toBe('unavailable');
  });

  it('is available up to 8 days, expired after 8 and hidden after 28', () => {
    expect(forecastStatus('covered', { issuedAt: issuedDaysAgo(8) }, now)).toBe('available');
    expect(forecastStatus('covered', { issuedAt: issuedDaysAgo(9) }, now)).toBe('expired');
    expect(forecastStatus('covered', { issuedAt: issuedDaysAgo(28) }, now)).toBe('expired');
    expect(forecastStatus('covered', { issuedAt: issuedDaysAgo(29) }, now)).toBe('hidden');
  });
});

describe('ageDays', () => {
  it('counts whole days and never goes negative', () => {
    expect(ageDays(issuedDaysAgo(2.9), now)).toBe(2);
    expect(ageDays(new Date(now.getTime() + 3_600_000), now)).toBe(0);
  });
});
