import { COMMODITIES, MARKETS } from '@kawan-pasar/catalog';
import { HIDDEN_AFTER_DAYS, ageDays } from '../modules/forecasts/forecast-status.js';
import type { ReadBundle } from './bundle-reader.js';

export type RejectReason =
  | 'checksum'
  | 'schema'
  | 'coverage'
  | 'market'
  | 'duplicate'
  | 'age'
  | 'cutoff'
  | 'empty'
  | 'already_known'
  | 'future'
  | 'superseded';

export type VerificationResult =
  | { readonly ok: true }
  | {
      readonly ok: false;
      readonly reasons: readonly RejectReason[];
      readonly details: readonly string[];
    };

/** Tolerated clock difference between the pipeline and the API. */
const CLOCK_SKEW_MS = 5 * 60_000;

const covered = new Set<string>(
  COMMODITIES.filter((c) => c.modelCoverage === 'covered').map((c) => c.code),
);
const available = new Set<string>(
  MARKETS.filter((m) => m.status === 'available').map((m) => m.code),
);

/** Contract checks of docs/data/kontrak-bundel-prediksi.md §2. Pure: no I/O. */
export function verifyBundle(bundle: ReadBundle, now: Date): VerificationResult {
  const reasons = new Set<RejectReason>();
  const details: string[] = [...bundle.schemaErrors];

  if (!bundle.checksumOk) reasons.add('checksum');
  if (bundle.schemaErrors.length > 0 || bundle.metadata === null) reasons.add('schema');
  if (bundle.rows.length === 0 && bundle.schemaErrors.length === 0) reasons.add('empty');

  const seen = new Set<string>();
  for (const r of bundle.rows) {
    if (!covered.has(r.commodity_code)) reasons.add('coverage');
    if (!available.has(r.market_code)) reasons.add('market');
    const key = `${r.market_code}|${r.commodity_code}|${String(r.horizon_days)}`;
    if (seen.has(key)) reasons.add('duplicate');
    seen.add(key);
  }

  const meta = bundle.metadata;
  if (meta !== null) {
    const issued = new Date(meta.issued_at);
    if (ageDays(issued, now) > HIDDEN_AFTER_DAYS) reasons.add('age');
    // A future issue time would never age out and would win "newest active" selection.
    if (issued.getTime() > now.getTime() + CLOCK_SKEW_MS) reasons.add('future');
    if (new Date(meta.data_cutoff) > issued) reasons.add('cutoff');
  }

  return reasons.size === 0 ? { ok: true } : { ok: false, reasons: [...reasons], details };
}
