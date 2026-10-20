/**
 * Money helpers. Prices travel as integer rupiah (docs 08 §2); intermediate products are kept
 * exact as long as possible and rounded once, half-up, to whole rupiah per recipe line.
 * Totals are sums of the rounded lines, so the numbers a user sees always add up.
 */

/** Strips binary floating-point noise (e.g. 2154.6999999997) before rounding. */
function denoise(value: number): number {
  return Number(value.toPrecision(15));
}

/** Rounds half away from zero to whole rupiah. */
export function roundRupiah(value: number): number {
  const clean = denoise(value);
  return Math.sign(clean) * Math.round(Math.abs(clean));
}

export function isNonNegativeSafeInteger(value: number): boolean {
  return Number.isSafeInteger(value) && value >= 0;
}

export function sumRupiah(values: readonly number[]): number {
  return values.reduce((total, value) => total + value, 0);
}
