import { err, ok, type Result } from './result.js';

export const QUANTITY_UNITS = ['g', 'kg', 'ml', 'l', 'butir'] as const;
export type QuantityUnit = (typeof QUANTITY_UNITS)[number];

/** Units in which a market price is quoted (PIHPS quotes per kg; cooking oil per litre). */
export const PRICE_UNITS = ['kg', 'l', 'butir'] as const;
export type PriceUnit = (typeof PRICE_UNITS)[number];

const MASS_IN_KG: ReadonlyMap<QuantityUnit, number> = new Map([
  ['g', 0.001],
  ['kg', 1],
]);
const VOLUME_IN_L: ReadonlyMap<QuantityUnit, number> = new Map([
  ['ml', 0.001],
  ['l', 1],
]);

export type QuantityInput = {
  readonly qty: number;
  readonly unit: QuantityUnit;
  /** Needed only when a recipe counts pieces (butir) but the price is per kg, e.g. eggs. */
  readonly gramsPerPiece?: number;
};

/** Converts a recipe quantity into the unit the price is quoted in. */
export function toPriceUnit(input: QuantityInput, priceUnit: PriceUnit): Result<number> {
  const { qty, unit } = input;
  if (!Number.isFinite(qty) || qty <= 0) {
    return err('INVALID_QUANTITY', `Takaran harus lebih dari 0, diterima ${String(qty)}.`);
  }
  if (priceUnit === 'kg') return massToKg(input);
  if (priceUnit === 'l') return convertWith(VOLUME_IN_L, qty, unit, priceUnit);
  return unit === 'butir' ? ok(qty) : mismatch(unit, priceUnit);
}

function massToKg({ qty, unit, gramsPerPiece }: QuantityInput): Result<number> {
  if (unit !== 'butir') return convertWith(MASS_IN_KG, qty, unit, 'kg');
  if (gramsPerPiece === undefined || !Number.isFinite(gramsPerPiece) || gramsPerPiece <= 0) {
    return err(
      'MISSING_PIECE_WEIGHT',
      'Bahan per butir dengan harga per kg butuh berat per butir.',
    );
  }
  return ok((qty * gramsPerPiece) / 1000);
}

function convertWith(
  factors: ReadonlyMap<QuantityUnit, number>,
  qty: number,
  unit: QuantityUnit,
  priceUnit: PriceUnit,
): Result<number> {
  const factor = factors.get(unit);
  return factor === undefined ? mismatch(unit, priceUnit) : ok(qty * factor);
}

function mismatch(unit: QuantityUnit, priceUnit: PriceUnit): Result<never> {
  return err('UNIT_MISMATCH', `Satuan ${unit} tidak bisa dikonversi ke harga per ${priceUnit}.`);
}
