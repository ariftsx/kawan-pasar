/** "39.000", "Rp 39000", "39 000" → 39000; empty → null; anything else → NaN. */
export function parseRupiah(raw: string): number | null {
  const s = raw.trim().replace(/^rp\.?\s*/i, '');
  if (s === '') return null;
  if (!/^\d{1,3}([.\s]?\d{3})*$/.test(s)) return Number.NaN;
  return Number(s.replace(/[.\s]/g, ''));
}
