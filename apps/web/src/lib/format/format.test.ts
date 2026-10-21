import { describe, expect, it } from 'vitest';

import { formatChange, formatMarketDate, formatRupiah } from './index';

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
