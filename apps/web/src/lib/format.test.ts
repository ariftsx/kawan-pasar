import { describe, expect, it } from 'vitest';
import {
  changeDirection,
  formatChange,
  formatDateWib,
  formatHorizon,
  formatRupiah,
} from './format';

const NBSP = ' ';

describe('formatRupiah', () => {
  it('groups thousands with dots and keeps Rp attached to the number', () => {
    expect(formatRupiah(52_400)).toBe(`Rp${NBSP}52.400`);
    expect(formatRupiah(1_234_567)).toBe(`Rp${NBSP}1.234.567`);
  });

  it('shows unknown values as an em dash, never as zero', () => {
    expect(formatRupiah(null)).toBe('—');
  });
});

describe('formatChange', () => {
  it('formats fractions as signed Indonesian percentages', () => {
    expect(formatChange(0.028)).toBe('+2,8%');
    expect(formatChange(-0.011)).toBe('−1,1%');
    expect(formatChange(0)).toBe('0,0%');
  });

  it('rounds half-way values instead of truncating', () => {
    expect(formatChange(0.02849)).toBe('+2,8%');
    expect(formatChange(0.0285)).toBe('+2,9%');
  });

  it('never shows a signed zero', () => {
    expect(formatChange(-0.0004)).toBe('0,0%');
  });

  it('shows unknown values as an em dash', () => {
    expect(formatChange(null)).toBe('—');
  });
});

describe('changeDirection', () => {
  it('treats changes that round to 0,0% as flat', () => {
    expect(changeDirection(0.0004)).toBe('flat');
    expect(changeDirection(0.032)).toBe('up');
    expect(changeDirection(-0.011)).toBe('down');
    expect(changeDirection(null)).toBeNull();
  });
});

describe('formatDateWib', () => {
  it('formats calendar dates without shifting the day', () => {
    expect(formatDateWib('2026-11-03', 'short')).toBe('Sel, 3 Nov 2026');
    expect(formatDateWib('2026-11-03', 'long')).toBe('Selasa, 3 November 2026');
    expect(formatDateWib('2026-12-31', 'short')).toBe('Kam, 31 Des 2026');
  });

  it('formats timestamps in Asia/Jakarta', () => {
    // 2026-12-31T20:00Z is already 1 January 2027 in WIB (UTC+7).
    expect(formatDateWib('2026-12-31T20:00:00Z', 'short')).toBe('Jum, 1 Jan 2027');
  });
});

describe('formatHorizon', () => {
  it('uses the v0.4 pill labels and long labels', () => {
    expect(formatHorizon(1)).toEqual({ short: '1H', long: '1 hari' });
    expect(formatHorizon(30)).toEqual({ short: '30H', long: '30 hari' });
    expect(formatHorizon(365)).toEqual({ short: '1T', long: '1 tahun' });
  });
});
