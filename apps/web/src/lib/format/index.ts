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

const dayMonth = new Intl.DateTimeFormat('id-ID', {
  day: 'numeric',
  month: 'short',
  timeZone: JAKARTA,
});

const weekdayDate = new Intl.DateTimeFormat('id-ID', {
  weekday: 'long',
  day: 'numeric',
  month: 'short',
  year: 'numeric',
  timeZone: JAKARTA,
});

const dateTime = new Intl.DateTimeFormat('id-ID', {
  day: 'numeric',
  month: 'short',
  year: 'numeric',
  hour: '2-digit',
  minute: '2-digit',
  timeZone: JAKARTA,
});

/** Chart axis label `YYYY-MM-DD` → `14 Okt`. */
export function formatDayMonth(date: string): string {
  return dayMonth.format(new Date(`${date}T00:00:00+07:00`));
}

/** `YYYY-MM-DD` → `Minggu, 18 Okt 2026`. */
export function formatWeekdayDate(date: string): string {
  return weekdayDate.format(new Date(`${date}T00:00:00+07:00`));
}

/** ISO timestamp → `18 Okt 2026, 12.00 WIB`. */
export function formatTimestamp(iso: string): string {
  return `${dateTime.format(new Date(iso))} WIB`;
}

/** Arrow plus percent, so the direction never depends on colour: `↑ +3,2%`, `↓ −1,1%`, `→ 0,0%`. */
export function formatChangeArrow(ratio: number | null): string {
  if (ratio === null) return '—';
  const arrow = ratio > 0.0005 ? '↑' : ratio < -0.0005 ? '↓' : '→';
  return `${arrow} ${formatChange(ratio)}`;
}
