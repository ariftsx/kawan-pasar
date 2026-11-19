import { describe, expect, it } from 'vitest';
import { parseRupiah } from './rupiah';

describe('parseRupiah', () => {
  it('reads the usual ways of writing a rupiah amount', () => {
    for (const s of ['39000', '39.000', 'Rp 39.000', 'rp39000', '39 000', ' Rp. 39.000 ']) {
      expect(parseRupiah(s), s).toBe(39_000);
    }
    expect(parseRupiah('')).toBeNull();
    expect(parseRupiah('1.250.000')).toBe(1_250_000);
  });

  it('refuses anything else instead of guessing', () => {
    for (const s of ['39,5', '-100', '39.00', 'abc', '1e5', '39.000,00']) {
      expect(Number.isNaN(parseRupiah(s)), s).toBe(true);
    }
  });
});
