/** Error codes returned by domain rules. Business failures are values, never thrown (docs 14 §3.3). */
export const DOMAIN_ERROR_CODES = [
  'INVALID_QUANTITY',
  'INVALID_PRICE',
  'INVALID_CHANGE',
  'INVALID_PORTIONS',
  'INVALID_SELL_PRICE',
  'INVALID_DATE',
  'UNIT_MISMATCH',
  'MISSING_PIECE_WEIGHT',
  'INGREDIENT_NOT_FOUND',
  'INGREDIENT_NOT_PRICED',
  'INVALID_INCREASE',
  'UNSORTED_SERIES',
] as const;

export type DomainErrorCode = (typeof DOMAIN_ERROR_CODES)[number];

export type DomainError = {
  readonly code: DomainErrorCode;
  readonly message: string;
};

export type Result<T> =
  { readonly ok: true; readonly value: T } | { readonly ok: false; readonly error: DomainError };

export function ok<T>(value: T): Result<T> {
  return { ok: true, value };
}

export function err<T = never>(code: DomainErrorCode, message: string): Result<T> {
  return { ok: false, error: { code, message } };
}
