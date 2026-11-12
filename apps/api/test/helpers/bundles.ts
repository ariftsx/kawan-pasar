import { createHash } from 'node:crypto';
import { mkdtemp, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { HORIZONS } from '@kawan-pasar/catalog';

export const CSV_HEADER =
  'market_code,commodity_code,base_date,horizon_days,q10_change,q50_change,q90_change,q10_price_idr,q50_price_idr,q90_price_idr,eval_status';

export interface TestRow {
  market_code?: string;
  commodity_code?: string;
  base_date?: string;
  horizon_days?: number;
  q10_change?: number | null;
  q50_change?: number | null;
  q90_change?: number | null;
  q10_price_idr?: number | null;
  q50_price_idr?: number | null;
  q90_price_idr?: number | null;
  eval_status?: string;
}

export function row(overrides: TestRow = {}): string {
  const r = {
    market_code: 'PIKJ',
    commodity_code: 'cabai-merah-keriting',
    base_date: '2026-09-30',
    horizon_days: 7,
    q10_change: -0.02,
    q50_change: 0.01,
    q90_change: 0.05,
    q10_price_idr: 51_352,
    q50_price_idr: 52_924,
    q90_price_idr: 55_020,
    eval_status: 'available',
    ...overrides,
  };
  return [
    r.market_code,
    r.commodity_code,
    r.base_date,
    r.horizon_days,
    r.q10_change,
    r.q50_change,
    r.q90_change,
    r.q10_price_idr,
    r.q50_price_idr,
    r.q90_price_idr,
    r.eval_status,
  ]
    .map((v) => (v === null ? '' : String(v)))
    .join(',');
}

/** Eight horizons for one commodity, with quantiles widening by horizon. */
export function fullRows(commodity = 'cabai-merah-keriting', base = 52_400): string[] {
  return HORIZONS.map((h, i) => {
    const spread = 0.01 * (i + 1);
    return row({
      commodity_code: commodity,
      horizon_days: h,
      q10_change: -spread,
      q50_change: 0.002 * (i + 1),
      q90_change: spread * 2,
      q10_price_idr: Math.round(base * (1 - spread)),
      q50_price_idr: Math.round(base * (1 + 0.002 * (i + 1))),
      q90_price_idr: Math.round(base * (1 + spread * 2)),
      eval_status: h <= 30 ? 'available' : h === 90 ? 'partial' : 'not_tested',
    });
  });
}

export interface BundleSpec {
  readonly bundleId: string;
  readonly issuedAt: string;
  readonly rows: readonly string[];
  readonly modelName?: string;
  readonly metadata?: Record<string, unknown>;
  readonly corruptChecksum?: boolean;
}

/** Writes a bundle directory (metadata.json, forecasts.csv, SHA256SUMS) and returns its path. */
export async function writeBundle(spec: BundleSpec): Promise<string> {
  const dir = await mkdtemp(path.join(tmpdir(), 'kp-bundle-'));
  const metadata = {
    bundle_id: spec.bundleId,
    model_name: spec.modelName ?? 'arif-net',
    model_version: 'v1.0.0',
    data_version: 'pihps-2026-09-30',
    preprocess_version: 'p1',
    data_cutoff: '2026-09-30T23:59:59+07:00',
    issued_at: spec.issuedAt,
    ...spec.metadata,
  };
  const csv = `${[CSV_HEADER, ...spec.rows].join('\n')}\n`;
  const metadataJson = JSON.stringify(metadata, null, 2);
  await writeFile(path.join(dir, 'forecasts.csv'), csv);
  await writeFile(path.join(dir, 'metadata.json'), metadataJson);
  const sha = (s: string): string => createHash('sha256').update(s).digest('hex');
  const csvSha = spec.corruptChecksum === true ? sha(`${csv}x`) : sha(csv);
  await writeFile(
    path.join(dir, 'SHA256SUMS'),
    `${csvSha}  forecasts.csv\n${sha(metadataJson)}  metadata.json\n`,
  );
  return dir;
}
