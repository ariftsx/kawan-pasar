import type { CommodityCode } from '@kawan-pasar/catalog';
import type { CommoditySummary } from '@kawan-pasar/contracts';
import { formatDateWib } from '@/lib/format';
import type { IconBoxTone } from '../atoms/IconBox';

const TONE: Record<CommodityCode, IconBoxTone> = {
  'cabai-merah-keriting': 'chili',
  'bawang-merah': 'chili',
  'beras-medium-1': 'green',
  'cabai-rawit-hijau': 'green',
  'cabai-rawit-merah': 'chili',
};

export const commodityTone = (code: CommodityCode): IconBoxTone => TONE[code];

/** One-line caption under a price: unit and data date, or why there is no price. */
export function dataStatusNote(item: CommoditySummary): string {
  if (item.latest === null) return 'Data belum tersedia';
  return `per ${item.unit} · ${formatDateWib(item.latest.observedOn, 'short')}`;
}
