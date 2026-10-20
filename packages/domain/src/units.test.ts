import { describe, expect, it } from 'vitest';

import { toPriceUnit } from './units.js';

describe('toPriceUnit', () => {
  it.each([
    [{ qty: 250, unit: 'g' }, 'kg', 0.25],
    [{ qty: 2, unit: 'kg' }, 'kg', 2],
    [{ qty: 15, unit: 'ml' }, 'l', 0.015],
    [{ qty: 1, unit: 'l' }, 'l', 1],
    [{ qty: 3, unit: 'butir' }, 'butir', 3],
    [{ qty: 2, unit: 'butir', gramsPerPiece: 60 }, 'kg', 0.12],
  ] as const)('converts %o to price unit %s', (input, priceUnit, expected) => {
    expect(toPriceUnit(input, priceUnit)).toEqual({ ok: true, value: expected });
  });

  it.each([
    [{ qty: 1, unit: 'g' }, 'l', 'UNIT_MISMATCH'],
    [{ qty: 1, unit: 'ml' }, 'kg', 'UNIT_MISMATCH'],
    [{ qty: 1, unit: 'g' }, 'butir', 'UNIT_MISMATCH'],
    [{ qty: 1, unit: 'butir' }, 'kg', 'MISSING_PIECE_WEIGHT'],
    [{ qty: 1, unit: 'butir', gramsPerPiece: 0 }, 'kg', 'MISSING_PIECE_WEIGHT'],
    [
      { qty: 1, unit: 'butir', gramsPerPiece: Number.POSITIVE_INFINITY },
      'kg',
      'MISSING_PIECE_WEIGHT',
    ],
    [{ qty: -2, unit: 'g' }, 'kg', 'INVALID_QUANTITY'],
    [{ qty: Number.NaN, unit: 'g' }, 'kg', 'INVALID_QUANTITY'],
  ] as const)('rejects %o for price unit %s', (input, priceUnit, code) => {
    const result = toPriceUnit(input, priceUnit);
    expect(result.ok ? undefined : result.error.code).toBe(code);
  });
});
