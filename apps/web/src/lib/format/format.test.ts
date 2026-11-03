import { describe, expect, it } from 'vitest';

import {
  formatChange,
  formatChangeArrow,
  formatDayMonth,
  formatMarketDate,
  formatRupiah,
  formatTimestamp,
  formatWeekdayDate,
} from './index';

const NBSP = ' ';

describe('formatRupiah', () => {
  it('formats whole rupiah the Indonesian way', () => {
    expect(formatRupiah(52_400)).toBe(`Rp${NBSP}52.400`);
    expect(formatRupiah(1_085_000)).toBe(`Rp${NBSP}1.085.000`);
  });

  it('uses a typographic minus and never turns unknown into Rp 0', () => {
    expect(formatRupiah(-1_500)).toBe(`−Rp${NBSP}1.500`);
    expect(formatRupiah(null)).toBe('—');
  });
});

describe('formatChange', () => {
  it('shows an explicit sign with one decimal', () => {
    expect(formatChange(0.032)).toBe('+3,2%');
    expect(formatChange(-0.015)).toBe('−1,5%');
    expect(formatChange(0)).toBe('0,0%');
    expect(formatChange(null)).toBe('—');
  });
});

describe('formatMarketDate', () => {
  it('formats WIB market dates with short Indonesian months', () => {
    expect(formatMarketDate('2026-10-14')).toBe('14 Okt 2026');
    expect(formatMarketDate('2026-01-01')).toBe('1 Jan 2026');
  });
});

describe('dates and arrows (v0.4)', () => {
  it('formats short, long, and timestamp dates in WIB', () => {
    expect(formatDayMonth('2026-10-14')).toBe('14 Okt');
    expect(formatWeekdayDate('2026-10-18')).toBe('Minggu, 18 Okt 2026');
    expect(formatTimestamp('2026-10-18T12:00:00+07:00')).toBe('18 Okt 2026, 12.00 WIB');
  });

  it('puts an arrow before every change', () => {
    expect(formatChangeArrow(0.032)).toBe('↑ +3,2%');
    expect(formatChangeArrow(-0.011)).toBe('↓ −1,1%');
    expect(formatChangeArrow(0)).toBe('→ 0,0%');
    expect(formatChangeArrow(null)).toBe('—');
  });
});
