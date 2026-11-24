import { ModelCandidateInputSchema } from '@kawan-pasar/contracts';
import type { AdminModelCandidatesResponse, ModelCandidateInput } from '@kawan-pasar/contracts';
import {
  Body,
  Controller,
  Get,
  Header,
  HttpStatus,
  Inject,
  Post,
  Res,
  UseGuards,
} from '@nestjs/common';
import { and, desc, eq, sql } from 'drizzle-orm';
import type { FastifyReply } from 'fastify';
import { conflict } from '../../common/api-errors.js';
import { UNIQUE_VIOLATION, pgCode } from '../../common/pg-errors.js';
import { ZodValidationPipe } from '../../common/zod-validation.pipe.js';
import type { Db } from '../../database/client.js';
import { modelCandidates } from '../../database/schema/index.js';
import { CsrfGuard, SessionGuard } from '../auth/session.guard.js';
import { AdminGuard } from './admin.guard.js';

export const MODEL_CANDIDATES = Symbol('MODEL_CANDIDATES');

/** Candidates of the retraining pipeline (Fase 4B task 5). */
export class ModelCandidatesRepository {
  constructor(private readonly db: Db) {}

  /**
   * `created` for a new candidate; `existing` when this exact run and bundle is already registered
   * (an Airflow retry); null when the run id or bundle id is taken by a different registration.
   */
  async register(c: ModelCandidateInput): Promise<{ id: number; created: boolean } | null> {
    try {
      const rows = await this.db
        .insert(modelCandidates)
        .values({
          runId: c.runId,
          bundleId: c.bundleId,
          bundleSha256: c.bundleSha256,
          modelVersion: c.modelVersion,
          dataEnd: c.dataEnd,
          lockOpen: c.lockOpen,
          commodities: c.commodities,
          overallRelmae: c.overallRelmae,
          scores: c.scores as Record<string, Record<string, number>>,
          windowStart: c.window.start,
          windowEnd: c.window.end,
        })
        .returning({ id: modelCandidates.id });
      const id = rows[0]?.id;
      return id === undefined ? null : { id, created: true };
    } catch (e) {
      if (pgCode(e) !== UNIQUE_VIOLATION) throw e;
      const [same] = await this.db
        .select({ id: modelCandidates.id })
        .from(modelCandidates)
        .where(
          and(
            eq(modelCandidates.runId, c.runId),
            eq(modelCandidates.bundleId, c.bundleId),
            eq(modelCandidates.bundleSha256, c.bundleSha256),
          ),
        )
        .limit(1);
      return same === undefined ? null : { id: same.id, created: false };
    }
  }

  async byId(id: number): Promise<CandidateRow | null> {
    const [row] = await this.db
      .select()
      .from(modelCandidates)
      .where(eq(modelCandidates.id, id))
      .limit(1);
    return row ?? null;
  }

  /** A decision is taken once, from `pending` only; false when it was already decided. */
  async decide(
    id: number,
    status: 'approved' | 'rejected',
    userId: string,
    note: string | null,
    now: Date,
  ): Promise<boolean> {
    const rows = await this.db
      .update(modelCandidates)
      .set({ status, decidedBy: userId, decidedAt: now, note })
      .where(and(eq(modelCandidates.id, id), eq(modelCandidates.status, 'pending')))
      .returning({ id: modelCandidates.id });
    return rows.length === 1;
  }

  /** Whether a newer bundle of this model is already active (approving would go backwards). */
  async superseded(modelName: string, issuedAt: string): Promise<boolean> {
    const rows = await this.db.execute(sql`
      SELECT 1 FROM forecast_artifacts
      WHERE status = 'active' AND model_name = ${modelName}
        AND issued_at > ${issuedAt}::timestamptz LIMIT 1`);
    return rows.rows.length > 0;
  }

  /** The overall relMAE of the approved candidate whose bundle is the active one. */
  async activeOverall(): Promise<number | null> {
    const rows = await this.db.execute(sql`
      SELECT c.overall_relmae::float8 AS overall FROM model_candidates c
      JOIN forecast_artifacts a ON a.bundle_id = c.bundle_id AND a.status = 'active'
      WHERE c.status = 'approved' ORDER BY c.decided_at DESC LIMIT 1`);
    const overall = rows.rows[0]?.['overall'];
    return typeof overall === 'number' ? overall : null;
  }

  async list(): Promise<AdminModelCandidatesResponse['items']> {
    const rows = await this.db
      .select()
      .from(modelCandidates)
      .orderBy(desc(modelCandidates.createdAt), desc(modelCandidates.id))
      .limit(50);
    return rows.map(toItem);
  }
}

export type CandidateRow = typeof modelCandidates.$inferSelect;

export function toItem(r: CandidateRow): AdminModelCandidatesResponse['items'][number] {
  return {
    id: r.id,
    runId: r.runId,
    bundleId: r.bundleId,
    modelVersion: r.modelVersion,
    dataEnd: r.dataEnd,
    lockOpen: r.lockOpen,
    commodities: r.commodities as AdminModelCandidatesResponse['items'][number]['commodities'],
    overallRelmae: r.overallRelmae,
    scores: r.scores,
    window: { start: r.windowStart, end: r.windowEnd },
    status: r.status,
    createdAt: r.createdAt.toISOString(),
  };
}

/** Registration by the pipeline (Airflow), with the service token like every internal route. */
@Controller('internal/model-candidates')
export class ModelCandidatesInternalController {
  constructor(@Inject(MODEL_CANDIDATES) private readonly repo: ModelCandidatesRepository) {}

  /** 201 for a new candidate, 200 for the same registration again (retries), 409 otherwise. */
  @Post()
  async register(
    @Body(new ZodValidationPipe(ModelCandidateInputSchema)) body: ModelCandidateInput,
    @Res({ passthrough: true }) reply: FastifyReply,
  ): Promise<{ id: number }> {
    const result = await this.repo.register(body);
    if (result === null) throw conflict('runId');
    void reply.status(result.created ? HttpStatus.CREATED : HttpStatus.OK);
    return { id: result.id };
  }
}

/** Read-only list for the admin pages (the audit and decision arrive in 4C). */
@Controller('v1/admin/model-candidates')
@UseGuards(SessionGuard, CsrfGuard, AdminGuard)
export class AdminModelCandidatesController {
  constructor(@Inject(MODEL_CANDIDATES) private readonly repo: ModelCandidatesRepository) {}

  @Get()
  @Header('cache-control', 'private, no-store')
  async list(): Promise<AdminModelCandidatesResponse> {
    return { items: await this.repo.list() };
  }
}
