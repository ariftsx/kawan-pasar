// Indonesian number and date formatting (docs 10 §4): `Rp 52.400`, `+3,2%`, `14 Okt 2026`.
// Intl inserts a no-break space after "Rp"; it is kept so the amount never wraps from its symbol.

const MINUS = '−';
const JAKARTA = 'Asia/Jakarta';

const rupiah = new Intl.NumberFormat('id-ID', {
  style: 'currency',
  currency: 'IDR',
  maximumFractionDigits: 0,
});

const percent = new Intl.NumberFormat('id-ID', {
  style: 'percent',
  minimumFractionDigits: 1,
  maximumFractionDigits: 1,
  signDisplay: 'exceptZero',
});

const marketDate = new Intl.DateTimeFormat('id-ID', {
  day: 'numeric',
  month: 'short',
  year: 'numeric',
  timeZone: JAKARTA,
});

/** Typographic minus (U+2212) for falling values. */
function withTypographicMinus(text: string): string {
  return text.replace('-', MINUS);
}

/** `null` means "unknown" and renders as an em dash, never as Rp 0. */
export function formatRupiah(amount: number | null): string {
  return amount === null ? '—' : withTypographicMinus(rupiah.format(amount));
}

/** Fraction to percent with an explicit sign: 0.032 → `+3,2%`, −0.015 → `−1,5%`. */
export function formatChange(ratio: number | null): string {
  return ratio === null ? '—' : withTypographicMinus(percent.format(ratio));
}

/** Market date `YYYY-MM-DD` (WIB) → `14 Okt 2026`. */
export function formatMarketDate(date: string): string {
  return marketDate.format(new Date(`${date}T00:00:00+07:00`));
}
