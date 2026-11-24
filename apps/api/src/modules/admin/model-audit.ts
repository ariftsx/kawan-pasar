import { realpath, stat } from 'node:fs/promises';
import { join, resolve, sep } from 'node:path';
import { AdminModelRejectInputSchema } from '@kawan-pasar/contracts';
import type {
  AdminModelCandidateDetail,
  AdminModelRejectInput,
  AdminModelRejectResponse,
  BundleForecastRow,
  ModelCandidateBlocker,
} from '@kawan-pasar/contracts';
import {
  Body,
  Controller,
  Get,
  Header,
  HttpCode,
  HttpStatus,
  Inject,
  Param,
  ParseIntPipe,
  Post,
  UseGuards,
} from '@nestjs/common';
import { CacheService } from '../../cache/cache.service.js';
import { ApiHttpError, notFound } from '../../common/api-errors.js';
import { CLOCK } from '../../common/clock.js';
import type { Clock } from '../../common/clock.js';
import { ZodValidationPipe } from '../../common/zod-validation.pipe.js';
import type { Db } from '../../database/client.js';
import { DRIZZLE } from '../../database/database.module.js';
import { auditLog } from '../../database/schema/index.js';
import { promoteBundle } from '../../bundles/bundle-promoter.js';
import { UNIQUE_VIOLATION, pgCode } from '../../common/pg-errors.js';
import { modelCandidates } from '../../database/schema/index.js';
import { and, eq } from 'drizzle-orm';
import { readBundle } from '../../bundles/bundle-reader.js';
import type { ReadBundle } from '../../bundles/bundle-reader.js';
import { verifyBundle } from '../../bundles/bundle-verifier.js';
import type { AuthContext } from '../auth/auth.service.js';
import { Auth, CsrfGuard, SessionGuard } from '../auth/session.guard.js';
import { WebRevalidator, tagsForScope } from '../internal/web-revalidator.js';
import {
  AirflowClient,
  AirflowRequestError,
  AirflowUnavailableError,
} from '../pipeline/airflow-client.js';
import { AdminGuard, RequiresConfirmation } from './admin.guard.js';
import { MODEL_CANDIDATES, ModelCandidatesRepository, toItem } from './model-candidates.js';
import type { CandidateRow } from './model-candidates.js';
import {
  AIRFLOW_CLIENT,
  PIPELINE_REPOSITORY,
  PipelineRepository,
  TRAIN_TRIGGERS_PER_DAY,
  wibDay,
} from './pipeline.js';

export const PIPELINE_RUNS_DIR = Symbol('PIPELINE_RUNS_DIR');

class AlreadyDecided extends Error {}
const RUN_ID = /^[A-Za-z0-9][A-Za-z0-9._-]{0,63}$/;
const BUNDLE_ID = /^arifnet-[a-z0-9._-]{1,120}$/;
const NO_STORE = 'private, no-store';
/** Sample market of the audit page (the only available market). */
const SAMPLE_MARKET = 'PIKJ';

/**
 * The bundle folder of a candidate inside the read-only runs mount, or null when the ids are not
 * the validated shapes or the path would leave the mount.
 */
export function bundleDir(runsDir: string, runId: string, bundleId: string): string | null {
  if (!RUN_ID.test(runId) || !BUNDLE_ID.test(bundleId)) return null;
  const root = resolve(runsDir);
  const dir = resolve(join(root, runId, 'out', 'bundles', bundleId));
  return dir.startsWith(root + sep) ? dir : null;
}

/** A directory whose real path (links resolved) is still inside the runs mount. */
async function insideDir(root: string, path: string): Promise<boolean> {
  try {
    if (!(await stat(path)).isDirectory()) return false;
    const [realRoot, real] = await Promise.all([realpath(root), realpath(path)]);
    return real.startsWith(realRoot + sep);
  } catch {
    return false;
  }
}

function sample(rows: readonly BundleForecastRow[], code: string, horizon: number) {
  const r = rows.find(
    (x) =>
      x.market_code === SAMPLE_MARKET && x.commodity_code === code && x.horizon_days === horizon,
  );
  return {
    q10: r?.q10_price_idr ?? null,
    q50: r?.q50_price_idr ?? null,
    q90: r?.q90_price_idr ?? null,
  };
}

/** The base price behind a 7-day forecast: price / (1 + change). */
function basePrice(rows: readonly BundleForecastRow[], code: string): number | null {
  const r = rows.find(
    (x) => x.market_code === SAMPLE_MARKET && x.commodity_code === code && x.horizon_days === 7,
  );
  if (r === undefined || r.q50_price_idr === null || r.q50_change === null) return null;
  return Math.round(r.q50_price_idr / (1 + r.q50_change));
}

/** Model page of the admin (Fase 4C, design § 4 / P8): audit, approve, reject. */
@Controller('v1/admin/model-candidates')
@UseGuards(SessionGuard, CsrfGuard, AdminGuard)
export class AdminModelAuditController {
  constructor(
    @Inject(MODEL_CANDIDATES) private readonly candidates: ModelCandidatesRepository,
    @Inject(PIPELINE_REPOSITORY) private readonly pipeline: PipelineRepository,
    @Inject(AIRFLOW_CLIENT) private readonly airflow: AirflowClient,
    @Inject(PIPELINE_RUNS_DIR) private readonly runsDir: string | null,
    @Inject(DRIZZLE) private readonly db: Db,
    @Inject(CLOCK) private readonly clock: Clock,
    private readonly cache: CacheService,
    @Inject(WebRevalidator) private readonly web: WebRevalidator,
  ) {}

  @Get(':id')
  @Header('cache-control', NO_STORE)
  async detail(@Param('id', ParseIntPipe) id: number): Promise<AdminModelCandidateDetail> {
    const row = await this.candidates.byId(id);
    if (row === null) throw notFound();
    return (await this.audit(row)).detail;
  }

  @Post(':id/approve')
  @HttpCode(204)
  @Header('cache-control', NO_STORE)
  @RequiresConfirmation()
  async approve(@Auth() auth: AuthContext, @Param('id', ParseIntPipe) id: number): Promise<void> {
    const row = await this.candidates.byId(id);
    if (row === null) throw notFound();
    const { detail, dir } = await this.audit(row);
    const blockers = detail.audit.blockers;
    if (blockers.length > 0 || dir === null) {
      throw new ApiHttpError(HttpStatus.CONFLICT, 'conflict', 'Kandidat belum lolos audit', {
        fields: blockers,
      });
    }
    const now = this.clock.now();
    const userId = auth.session.userId;
    // The promotion path of Fase 1/2B (same verifier, one transaction), plus: the files read now
    // must be the registered ones, their data must end by the candidate's data end, and the
    // candidate is claimed (pending → approved, audited) inside the activation transaction, so a
    // concurrent decision or a failure leaves neither an active bundle nor a decided candidate.
    let result;
    try {
      result = await promoteBundle(this.db, dir, now, undefined, {
        expectedSumsSha256: row.bundleSha256,
        maxDataCutoff: new Date(`${row.dataEnd}T23:59:59+07:00`),
        recordRejections: false,
        inTransaction: async (tx) => {
          const claimed = await tx
            .update(modelCandidates)
            .set({ status: 'approved', decidedBy: userId, decidedAt: now })
            .where(and(eq(modelCandidates.id, id), eq(modelCandidates.status, 'pending')))
            .returning({ id: modelCandidates.id });
          if (claimed.length !== 1) throw new AlreadyDecided();
          await tx.insert(auditLog).values({
            actorId: userId,
            action: 'model_approve',
            target: row.bundleId,
            createdAt: now,
          });
        },
      });
    } catch (e) {
      // Decided meanwhile, or a concurrent approval activated the same bundle first.
      if (e instanceof AlreadyDecided || pgCode(e) === UNIQUE_VIOLATION) {
        throw new ApiHttpError(HttpStatus.CONFLICT, 'conflict', 'Kandidat sudah diputuskan', {
          fields: ['decided'],
        });
      }
      throw e;
    }
    if (result.status !== 'active') {
      throw new ApiHttpError(HttpStatus.CONFLICT, 'conflict', 'Bundel ditolak verifikator', {
        fields: [...result.reasons],
      });
    }
    // After the commit: drop cached forecasts and prices, revalidate the web pages.
    await this.cache.invalidate('forecasts');
    await this.cache.invalidate('prices');
    await this.web.revalidate([...tagsForScope('forecasts'), ...tagsForScope('prices')]);
  }

  @Post(':id/reject')
  @Header('cache-control', NO_STORE)
  @RequiresConfirmation()
  async reject(
    @Auth() auth: AuthContext,
    @Param('id', ParseIntPipe) id: number,
    @Body(new ZodValidationPipe(AdminModelRejectInputSchema)) body: AdminModelRejectInput,
  ): Promise<AdminModelRejectResponse> {
    const row = await this.candidates.byId(id);
    if (row === null) throw notFound();
    const decided = await this.candidates.decide(
      id,
      'rejected',
      auth.session.userId,
      body.note,
      this.clock.now(),
    );
    if (!decided)
      throw new ApiHttpError(HttpStatus.CONFLICT, 'conflict', 'Kandidat sudah diputuskan');
    await this.db
      .insert(auditLog)
      .values({ actorId: auth.session.userId, action: 'model_reject', target: row.bundleId });
    return { retrain: await this.retrainAfterReject(row, auth.session.userId) };
  }

  /** Owner ruling K4: a rejection retrains only with the lock open and quota left. */
  private async retrainAfterReject(
    row: CandidateRow,
    userId: string,
  ): Promise<AdminModelRejectResponse['retrain']> {
    if (!row.lockOpen) return 'locked';
    if (!this.airflow.configured) return 'airflow_inactive';
    const used = await this.pipeline.retrainTriggersSince(wibDay(this.clock.now()).startUtc);
    if (used >= TRAIN_TRIGGERS_PER_DAY) return 'quota';
    try {
      await this.airflow.trigger('latih_ulang', {});
    } catch (e) {
      if (e instanceof AirflowUnavailableError || e instanceof AirflowRequestError) {
        return 'airflow_inactive';
      }
      throw e;
    }
    await this.pipeline.audit(userId, 'pipeline_trigger', 'latih_ulang', this.clock.now());
    return 'triggered';
  }

  private async audit(
    row: CandidateRow,
  ): Promise<{ detail: AdminModelCandidateDetail; dir: string | null }> {
    const now = this.clock.now();
    const blockers = new Set<ModelCandidateBlocker>();
    if (row.status !== 'pending') blockers.add('decided');
    // Protocol (owner ruling K3): a locked-run candidate is for verification only.
    if (!row.lockOpen) blockers.add('locked');
    if (!(row.overallRelmae < 1)) blockers.add('quality');

    const candidateDir =
      this.runsDir === null ? null : bundleDir(this.runsDir, row.runId, row.bundleId);
    const dir =
      candidateDir !== null &&
      this.runsDir !== null &&
      (await insideDir(this.runsDir, candidateDir))
        ? candidateDir
        : null;
    let bundle: ReadBundle | null = null;
    let runtime: { ok: boolean; reasons: string[] } = { ok: false, reasons: ['files'] };
    if (dir === null) {
      blockers.add('files');
    } else {
      bundle = await readBundle(dir);
      const verification = verifyBundle(bundle, now);
      const reasons: string[] = verification.ok ? [] : [...verification.reasons];
      if (bundle.forecastsSha256.length > 0 && row.status === 'pending') {
        // The registered checksum file must still be the one in the folder.
        const sums = await readSums(dir);
        if (sums !== row.bundleSha256) reasons.push('checksum');
      }
      // Protocol: the bundle's data must end by the candidate's data end.
      const cutoff = bundle.metadata?.data_cutoff;
      if (cutoff !== undefined && new Date(cutoff) > new Date(`${row.dataEnd}T23:59:59+07:00`)) {
        reasons.push('cutoff');
      }
      runtime = { ok: reasons.length === 0, reasons };
      if (reasons.includes('age')) blockers.add('expired');
      if (reasons.some((r) => r !== 'age')) blockers.add('runtime');
      const meta = bundle.metadata;
      if (meta !== null && (await this.candidates.superseded(meta.model_name, meta.issued_at))) {
        blockers.add('superseded');
      }
    }

    const rows = bundle?.rows ?? [];
    const detail: AdminModelCandidateDetail = {
      candidate: {
        ...toItem(row),
        note: row.note,
        decidedAt: row.decidedAt === null ? null : row.decidedAt.toISOString(),
      },
      audit: {
        runtime,
        quality: {
          overall: row.overallRelmae,
          pass: row.overallRelmae < 1,
          activeOverall: await this.candidates.activeOverall(),
        },
        samples: toItem(row).commodities.map((code) => ({
          commodity: code,
          basePriceIdr: basePrice(rows, code),
          h7: sample(rows, code, 7),
          h30: sample(rows, code, 30),
          h90: sample(rows, code, 90),
        })),
        issuedAt: bundle?.metadata?.issued_at ?? null,
        blockers: [...blockers],
      },
    };
    return { detail, dir };
  }
}

/** SHA-256 of the bundle's SHA256SUMS file, as registered by the pipeline. */
async function readSums(dir: string): Promise<string | null> {
  const { createHash } = await import('node:crypto');
  const { readFile } = await import('node:fs/promises');
  try {
    return createHash('sha256')
      .update(await readFile(join(dir, 'SHA256SUMS')))
      .digest('hex');
  } catch {
    return null;
  }
}
