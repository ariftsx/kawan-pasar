import { describe, expect, it } from 'vitest';
import { isoWeek, nextTrainingDate, trainsOn } from '../../src/modules/pipeline/schedule.js';

describe('retraining schedule presets (Fase 4C K2)', () => {
  it('computes ISO weeks, including the turn of the year', () => {
    expect(isoWeek('2026-11-23')).toBe(48);
    expect(isoWeek('2026-12-28')).toBe(53);
    expect(isoWeek('2027-01-04')).toBe(1);
    expect(isoWeek('2021-01-01')).toBe(53);
  });

  it('trains on the days each preset names', () => {
    // 2026-11-23 and 2026-11-30 are Mondays (ISO weeks 48 and 49); 2026-11-24 is a Tuesday.
    expect(trainsOn('weekly_monday', '2026-11-23')).toBe(true);
    expect(trainsOn('weekly_monday', '2026-11-24')).toBe(false);
    expect(trainsOn('daily', '2026-11-24')).toBe(true);
    expect(trainsOn('biweekly_monday', '2026-11-23')).toBe(true);
    expect(trainsOn('biweekly_monday', '2026-11-30')).toBe(false);
    expect(trainsOn('monthly_first_monday', '2026-12-07')).toBe(true);
    expect(trainsOn('monthly_first_monday', '2026-11-23')).toBe(false);
    expect(trainsOn('manual', '2026-11-23')).toBe(false);
  });

  it('names the next training day, or none for manual', () => {
    expect(nextTrainingDate('weekly_monday', '2026-11-24')).toBe('2026-11-30');
    expect(nextTrainingDate('biweekly_monday', '2026-11-24')).toBe('2026-12-07');
    expect(nextTrainingDate('monthly_first_monday', '2026-11-24')).toBe('2026-12-07');
    expect(nextTrainingDate('daily', '2026-11-24')).toBe('2026-11-24');
    expect(nextTrainingDate('manual', '2026-11-24')).toBeNull();
  });
});
