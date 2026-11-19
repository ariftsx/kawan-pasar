import { describe, expect, it } from 'vitest';
import { toPriceExportCsv } from '../../src/bundles/price-export.js';

describe('toPriceExportCsv (input of the ARIF-Net export job)', () => {
  it('writes the agreed header and rows sorted by commodity, then by day', () => {
    const csv = toPriceExportCsv(
      new Map([
        [
          'cabai-merah-keriting',
          [
            { observedOn: '2026-09-30', priceIdr: 63150 },
            { observedOn: '2026-09-29', priceIdr: 63000 },
          ],
        ],
        ['bawang-merah', [{ observedOn: '2026-09-30', priceIdr: 40300 }]],
      ]),
    );
    expect(csv).toBe(
      'commodity_code,observed_on,price_idr\n' +
        'bawang-merah,2026-09-30,40300\n' +
        'cabai-merah-keriting,2026-09-29,63000\n' +
        'cabai-merah-keriting,2026-09-30,63150\n',
    );
  });
});
