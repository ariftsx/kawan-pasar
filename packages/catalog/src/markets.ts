export type MarketCode = 'PIKJ' | 'PSEN' | 'PITT' | 'PBKS';

export type MarketStatus = 'available' | 'coming_soon';

export interface Market {
  readonly code: MarketCode;
  readonly name: string;
  readonly city: string;
  readonly status: MarketStatus;
}

export const MARKETS = [
  { code: 'PIKJ', name: 'Pasar Kramat Jati', city: 'Jakarta', status: 'available' },
  { code: 'PSEN', name: 'Pasar Senen', city: 'Jakarta', status: 'coming_soon' },
  { code: 'PITT', name: 'Pasar Induk Tanah Tinggi', city: 'Tangerang', status: 'coming_soon' },
  { code: 'PBKS', name: 'Pasar Bekasi', city: 'Bekasi', status: 'coming_soon' },
] as const satisfies readonly Market[];
