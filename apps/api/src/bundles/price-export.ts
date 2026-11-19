import type { CommodityCode } from '@kawan-pasar/catalog';
import type { PricePoint } from '@kawan-pasar/contracts';

/**
 * The price file handed to the ARIF-Net export job (services/model-arifnet, ADR 0012): one row
 * per observation, oldest first per commodity. The job never reads the database itself.
 */
export const PRICE_EXPORT_HEADER = 'commodity_code,observed_on,price_idr';

export function toPriceExportCsv(
  series: ReadonlyMap<CommodityCode, readonly PricePoint[]>,
): string {
  const lines = [PRICE_EXPORT_HEADER];
  for (const code of [...series.keys()].sort()) {
    const points = [...(series.get(code) ?? [])].sort((a, b) =>
      a.observedOn.localeCompare(b.observedOn),
    );
    for (const p of points) lines.push(`${code},${p.observedOn},${String(p.priceIdr)}`);
  }
  return `${lines.join('\n')}\n`;
}
