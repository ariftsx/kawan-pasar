import { describe, expect, it } from 'vitest';
import { AdminDecisionInputSchema, maskEmail } from './admin.js';

describe('admin contracts', () => {
  it('masks e-mail addresses to the first letter and the domain', () => {
    expect(maskEmail('sari.wulandari@contoh.id')).toBe('s***@contoh.id');
    expect(maskEmail('a@b.id')).toBe('a***@b.id');
    expect(maskEmail('rusak')).toBe('***');
  });

  it('a decision is approve or reject with an optional note of at most 500 characters', () => {
    expect(
      AdminDecisionInputSchema.parse({ decision: 'reject', note: '  Kurang rinci  ' }),
    ).toEqual({
      decision: 'reject',
      note: 'Kurang rinci',
    });
    expect(AdminDecisionInputSchema.safeParse({ decision: 'maybe' }).success).toBe(false);
    expect(
      AdminDecisionInputSchema.safeParse({ decision: 'reject', note: 'x'.repeat(501) }).success,
    ).toBe(false);
  });
});
