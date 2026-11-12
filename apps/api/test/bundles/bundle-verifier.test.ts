import { describe, expect, it } from 'vitest';
import { readBundle } from '../../src/bundles/bundle-reader.js';
import { verifyBundle } from '../../src/bundles/bundle-verifier.js';
import { fullRows, row, writeBundle } from '../helpers/bundles.js';

const now = new Date('2026-11-11T10:00:00+07:00');
const fresh = '2026-11-10T07:00:00+07:00';

async function verify(spec: Parameters<typeof writeBundle>[0]): Promise<readonly string[]> {
  const result = verifyBundle(await readBundle(await writeBundle(spec)), now);
  return result.ok ? [] : result.reasons;
}

describe('verifyBundle', () => {
  it('accepts a clean bundle', async () => {
    expect(await verify({ bundleId: 'b-clean', issuedAt: fresh, rows: fullRows() })).toEqual([]);
  });

  it('rejects a bundle whose checksum does not match', async () => {
    const reasons = await verify({
      bundleId: 'b-sum',
      issuedAt: fresh,
      rows: fullRows(),
      corruptChecksum: true,
    });
    expect(reasons).toContain('checksum');
  });

  it('rejects horizons outside the product horizons', async () => {
    expect(
      await verify({ bundleId: 'b-h', issuedAt: fresh, rows: [row({ horizon_days: 2 })] }),
    ).toContain('schema');
  });

  it('rejects non-monotonic quantiles', async () => {
    const bad = row({ q10_change: 0.05, q50_change: 0.02, q90_change: 0.08 });
    expect(await verify({ bundleId: 'b-q', issuedAt: fresh, rows: [bad] })).toContain('schema');
  });

  it('rejects empty version metadata', async () => {
    expect(
      await verify({
        bundleId: 'b-meta',
        issuedAt: fresh,
        rows: fullRows(),
        metadata: { model_version: '' },
      }),
    ).toContain('schema');
  });

  it('rejects commodities outside the model coverage', async () => {
    expect(
      await verify({
        bundleId: 'b-cov',
        issuedAt: fresh,
        rows: [row({ commodity_code: 'cabai-rawit-hijau' })],
      }),
    ).toContain('coverage');
  });

  it('rejects markets that are not available', async () => {
    expect(
      await verify({ bundleId: 'b-mkt', issuedAt: fresh, rows: [row({ market_code: 'PSEN' })] }),
    ).toContain('market');
  });

  it('rejects duplicate (market, commodity, horizon) rows', async () => {
    expect(await verify({ bundleId: 'b-dup', issuedAt: fresh, rows: [row(), row()] })).toContain(
      'duplicate',
    );
  });

  it('rejects bundles older than 28 days', async () => {
    expect(
      await verify({ bundleId: 'b-old', issuedAt: '2026-10-10T07:00:00+07:00', rows: fullRows() }),
    ).toContain('age');
  });

  it('rejects a data cutoff after the issue time', async () => {
    expect(
      await verify({
        bundleId: 'b-cut',
        issuedAt: fresh,
        rows: fullRows(),
        metadata: { data_cutoff: '2026-11-10T08:00:00+07:00' },
      }),
    ).toContain('cutoff');
  });

  it('rejects a bundle without rows', async () => {
    expect(await verify({ bundleId: 'b-empty', issuedAt: fresh, rows: [] })).toContain('empty');
  });
});

describe('verifyBundle issue time', () => {
  it('rejects a bundle issued in the future (clock skew or typo)', async () => {
    expect(
      await verify({
        bundleId: 'b-future',
        issuedAt: '2026-11-12T10:00:00+07:00',
        rows: fullRows(),
      }),
    ).toContain('future');
  });

  it('tolerates a few minutes of clock skew', async () => {
    expect(
      await verify({ bundleId: 'b-skew', issuedAt: '2026-11-11T10:03:00+07:00', rows: fullRows() }),
    ).toEqual([]);
  });
});
