import { describe, expect, it } from 'vitest';
import { businessDaysBetween, dataStatus, wibDate } from './staleness.js';

describe('businessDaysBetween', () => {
  it('counts Monday–Friday days after `from` up to and including `to`', () => {
    expect(businessDaysBetween('2026-11-06', '2026-11-10')).toBe(2); // Fri → Tue: Mon, Tue
    expect(businessDaysBetween('2026-11-06', '2026-11-11')).toBe(3); // Fri → Wed
  });

  it('skips the weekend', () => {
    expect(businessDaysBetween('2026-11-07', '2026-11-09')).toBe(1); // Sat → Mon
  });

  it('is zero for the same day and for a `to` before `from`', () => {
    expect(businessDaysBetween('2026-11-11', '2026-11-11')).toBe(0);
    expect(businessDaysBetween('2026-11-11', '2026-11-01')).toBe(0);
  });
});

describe('dataStatus', () => {
  it('is fresh up to two business days and stale after', () => {
    expect(dataStatus('2026-11-06', '2026-11-10')).toBe('fresh');
    expect(dataStatus('2026-11-06', '2026-11-11')).toBe('stale');
  });

  it('is no_data when nothing was ever observed', () => {
    expect(dataStatus(null, '2026-11-11')).toBe('no_data');
  });
});

describe('wibDate', () => {
  it('uses the Asia/Jakarta calendar day (UTC+7)', () => {
    expect(wibDate(new Date('2026-11-11T16:59:59Z'))).toBe('2026-11-11');
    expect(wibDate(new Date('2026-11-11T17:00:00Z'))).toBe('2026-11-12');
  });
});
