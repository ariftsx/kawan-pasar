/** Forecast horizons in days, as defined by the product scope (1 day to 1 year). */
export const HORIZONS = [1, 3, 7, 14, 30, 90, 180, 365] as const;

export type Horizon = (typeof HORIZONS)[number];
