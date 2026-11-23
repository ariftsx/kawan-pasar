import { describe, expect, it } from 'vitest';
import { AnalystRequestInputSchema, ExportQuerySchema, csvCell } from './analyst.js';

describe('analyst contracts', () => {
  it('a request needs a 10-500 character reason; organization is optional', () => {
    expect(AnalystRequestInputSchema.safeParse({ reason: 'pendek' }).success).toBe(false);
    expect(
      AnalystRequestInputSchema.parse({
        reason: '  Skripsi tentang inflasi pangan  ',
        organization: 'UMB',
      }),
    ).toEqual({ reason: 'Skripsi tentang inflasi pangan', organization: 'UMB' });
    expect(AnalystRequestInputSchema.safeParse({ reason: 'x'.repeat(501) }).success).toBe(false);
  });

  it('export filters: known commodity codes and an ordered date range', () => {
    expect(ExportQuerySchema.parse({ commodities: 'bawang-merah,beras-medium-1' })).toEqual({
      commodities: ['bawang-merah', 'beras-medium-1'],
    });
    expect(ExportQuerySchema.safeParse({ commodities: 'gula' }).success).toBe(false);
    expect(ExportQuerySchema.safeParse({ from: '2026-09-30', to: '2026-01-01' }).success).toBe(
      false,
    );
    expect(ExportQuerySchema.safeParse({ from: '30-09-2026' }).success).toBe(false);
    expect(ExportQuerySchema.parse({})).toEqual({});
  });

  it('csvCell neutralises formulas and quotes separators, but keeps negative numbers', () => {
    expect(csvCell('=HYPERLINK("x")')).toBe(`"'=HYPERLINK(""x"")"`);
    expect(csvCell('+62 812')).toBe("'+62 812");
    expect(csvCell('@SUM(A1)')).toBe("'@SUM(A1)");
    expect(csvCell(-0.0312)).toBe('-0.0312');
    expect(csvCell('Bawang merah, sedang')).toBe('"Bawang merah, sedang"');
    expect(csvCell(null)).toBe('');
    // Leading spaces before a formula character are neutralised too.
    expect(csvCell('  =1+1')).toBe("'  =1+1");
    expect(csvCell('-1+1')).toBe("'-1+1");
  });
});
