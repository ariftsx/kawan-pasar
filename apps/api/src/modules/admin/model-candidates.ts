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
import { and, desc, eq } from 'drizzle-orm';
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

  async list(): Promise<AdminModelCandidatesResponse['items']> {
    const rows = await this.db
      .select()
      .from(modelCandidates)
      .orderBy(desc(modelCandidates.createdAt), desc(modelCandidates.id))
      .limit(50);
    return rows.map((r) => ({
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
    }));
  }
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
