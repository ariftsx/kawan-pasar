import { describe, expect, it } from 'vitest';
import {
  AdminDecisionInputSchema,
  ModelCandidateInputSchema,
  PROSPECTIVE_LOCKED_DATA_END,
  maskEmail,
} from './admin.js';

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

describe('model candidate input (Fase 4B)', () => {
  const valid = {
    runId: '20261207T030000Z',
    bundleId: 'arifnet-2026-12-04-202612070330-1a2b3c4d',
    bundleSha256: 'a'.repeat(64),
    modelVersion: 'arifnet-a0-kp-20261207T030000Z',
    dataEnd: '2026-12-04',
    lockOpen: true,
    commodities: ['cabai-merah-keriting', 'cabai-rawit-hijau'],
    overallRelmae: 0.87,
    scores: { 'cabai-merah-keriting': { '1': 1, '365': 0.63 } },
    window: { start: '2024-12-04', end: '2025-12-04' },
  };

  it('accepts a pipeline registration', () => {
    expect(ModelCandidateInputSchema.safeParse(valid).success).toBe(true);
  });

  it('refuses unknown commodities, path-like run ids, and bad hashes', () => {
    expect(ModelCandidateInputSchema.safeParse({ ...valid, commodities: ['gula'] }).success).toBe(
      false,
    );
    expect(ModelCandidateInputSchema.safeParse({ ...valid, runId: '../x' }).success).toBe(false);
    expect(ModelCandidateInputSchema.safeParse({ ...valid, bundleSha256: 'xyz' }).success).toBe(
      false,
    );
    expect(
      ModelCandidateInputSchema.safeParse({ ...valid, scores: { gula: { '1': 1 } } }).success,
    ).toBe(false);
  });

  it('refuses a locked-run candidate with data after the protocol ceiling', () => {
    const locked = { ...valid, lockOpen: false };
    expect(ModelCandidateInputSchema.safeParse(locked).success).toBe(false);
    expect(
      ModelCandidateInputSchema.safeParse({ ...locked, dataEnd: PROSPECTIVE_LOCKED_DATA_END })
        .success,
    ).toBe(true);
  });
});
