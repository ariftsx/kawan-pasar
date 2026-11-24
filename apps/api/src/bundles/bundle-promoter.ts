import { sql } from 'drizzle-orm';
import { z } from 'zod';
import type { Db } from '../database/client.js';
import { readBundle } from './bundle-reader.js';
import type { RejectReason } from './bundle-verifier.js';
import { verifyBundle } from './bundle-verifier.js';

export const DEMO_MODEL_NAME = 'demo';

export interface PromotionResult {
  readonly status: 'active' | 'rejected';
  readonly bundleId: string | null;
  readonly reasons: readonly RejectReason[];
  readonly details: readonly string[];
}

const IdRow = z.object({ id: z.coerce.number().int() });

/** The transaction handle `db.transaction` passes to its callback. */
export type DbTx = Parameters<Parameters<Db['transaction']>[0]>[0];

/** Fase 4C: promotion of an audited pipeline candidate by an admin. */
export interface PromoteOptions {
  /** The SHA256SUMS hash registered for the candidate: the files read now must be those. */
  readonly expectedSumsSha256?: string;
  /** Latest allowed `data_cutoff` (the candidate's data end, protocol lock). */
  readonly maxDataCutoff?: Date;
  /** false: a refused bundle leaves no `rejected` artifact row (the candidate stays decidable). */
  readonly recordRejections?: boolean;
  /** Runs inside the activation transaction; throwing rolls the activation back. */
  readonly inTransaction?: (tx: DbTx) => Promise<void>;
}

/**
 * Verifies a bundle directory and, if valid, makes it the active bundle of its model in one
 * transaction (insert artifact + rows, retire the previous active bundle, activate the new one).
 * Invalid bundles whose metadata is readable are recorded as `rejected`; the active bundle is never
 * touched by a failed promotion. `afterActivate` runs only after a successful commit.
 */
export async function promoteBundle(
  db: Db,
  dir: string,
  now: Date,
  afterActivate?: () => Promise<void>,
  options: PromoteOptions = {},
): Promise<PromotionResult> {
  const bundle = await readBundle(dir);
  const meta = bundle.metadata;
  const verification = verifyBundle(bundle, now);

  if (meta !== null) {
    const known = await db.execute(
      sql`SELECT 1 FROM forecast_artifacts WHERE bundle_id = ${meta.bundle_id}`,
    );
    if (known.rows.length > 0) {
      return {
        status: 'rejected',
        bundleId: meta.bundle_id,
        reasons: ['already_known'],
        details: [],
      };
    }
  }

  // A bundle older than the active one of the same model would replace newer forecasts.
  let reasons: RejectReason[] = verification.ok ? [] : [...verification.reasons];
  if (
    options.expectedSumsSha256 !== undefined &&
    bundle.sumsSha256 !== options.expectedSumsSha256
  ) {
    reasons = [...new Set<RejectReason>([...reasons, 'checksum'])];
  }
  if (
    options.maxDataCutoff !== undefined &&
    meta !== null &&
    new Date(meta.data_cutoff) > options.maxDataCutoff
  ) {
    reasons = [...new Set<RejectReason>([...reasons, 'cutoff'])];
  }
  if (meta !== null) {
    const newer = await db.execute(sql`
      SELECT 1 FROM forecast_artifacts
      WHERE status = 'active' AND model_name = ${meta.model_name}
        AND issued_at > ${meta.issued_at}::timestamptz`);
    if (newer.rows.length > 0) reasons = [...reasons, 'superseded'];
  }

  if (reasons.length > 0) {
    if (meta !== null && options.recordRejections !== false) {
      const checksum = /^[0-9a-f]{64}$/.test(bundle.forecastsSha256)
        ? bundle.forecastsSha256
        : '0'.repeat(64);
      await db.execute(sql`
        INSERT INTO forecast_artifacts (bundle_id, model_name, model_version, data_version,
          preprocess_version, data_cutoff, issued_at, checksum_sha256, status, is_demo,
          reject_reasons)
        VALUES (${meta.bundle_id}, ${meta.model_name}, ${meta.model_version}, ${meta.data_version},
          ${meta.preprocess_version}, ${meta.data_cutoff}, ${meta.issued_at}, ${checksum},
          'rejected', ${meta.model_name === DEMO_MODEL_NAME},
          ARRAY[${sql.join(
            reasons.map((r) => sql`${r}`),
            sql`, `,
          )}]::text[])`);
    }
    return {
      status: 'rejected',
      bundleId: meta?.bundle_id ?? null,
      reasons,
      details: verification.ok ? [] : verification.details,
    };
  }

  // verifyBundle guarantees metadata here; the check keeps the types honest without assertions.
  if (meta === null) throw new Error('verified bundle without metadata');

  await db.transaction(async (tx) => {
    const inserted = await tx.execute(sql`
      INSERT INTO forecast_artifacts (bundle_id, model_name, model_version, data_version,
        preprocess_version, data_cutoff, issued_at, checksum_sha256, status, is_demo)
      VALUES (${meta.bundle_id}, ${meta.model_name}, ${meta.model_version}, ${meta.data_version},
        ${meta.preprocess_version}, ${meta.data_cutoff}, ${meta.issued_at},
        ${bundle.forecastsSha256}, 'pending', ${meta.model_name === DEMO_MODEL_NAME})
      RETURNING id`);
    const artifactId = IdRow.parse(inserted.rows[0]).id;

    const r = bundle.rows;
    await tx.execute(sql`
      INSERT INTO forecasts (artifact_id, market_id, commodity_id, base_date, horizon_days,
        q10_change, q50_change, q90_change, q10_price_idr, q50_price_idr, q90_price_idr, eval_status)
      SELECT ${artifactId}, m.id, c.id, t.base_date, t.horizon, t.q10c, t.q50c, t.q90c,
             t.q10p, t.q50p, t.q90p, t.eval::eval_status
      FROM unnest(
        ${sql.param(r.map((x) => x.market_code))}::text[], ${sql.param(r.map((x) => x.commodity_code))}::text[],
        ${sql.param(r.map((x) => x.base_date))}::date[], ${sql.param(r.map((x) => x.horizon_days))}::smallint[],
        ${sql.param(r.map((x) => x.q10_change))}::numeric[], ${sql.param(r.map((x) => x.q50_change))}::numeric[],
        ${sql.param(r.map((x) => x.q90_change))}::numeric[], ${sql.param(r.map((x) => x.q10_price_idr))}::int[],
        ${sql.param(r.map((x) => x.q50_price_idr))}::int[], ${sql.param(r.map((x) => x.q90_price_idr))}::int[],
        ${sql.param(r.map((x) => x.eval_status))}::text[]
      ) AS t(market, commodity, base_date, horizon, q10c, q50c, q90c, q10p, q50p, q90p, eval)
      JOIN markets m ON m.code = t.market
      JOIN commodities c ON c.code = t.commodity`);

    await tx.execute(sql`
      UPDATE forecast_artifacts SET status = 'retired'
      WHERE status = 'active' AND model_name = ${meta.model_name}`);
    await tx.execute(sql`UPDATE forecast_artifacts SET status = 'active' WHERE id = ${artifactId}`);
    if (options.inTransaction !== undefined) await options.inTransaction(tx);
  });

  if (afterActivate !== undefined) await afterActivate();
  return { status: 'active', bundleId: meta.bundle_id, reasons: [], details: [] };
}
