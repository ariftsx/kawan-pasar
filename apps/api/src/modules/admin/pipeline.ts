import {
  AdminPipelineDagInputSchema,
  AdminScheduleInputSchema,
  SchedulePresetSchema,
} from '@kawan-pasar/contracts';
import type {
  AdminPipelineDagInput,
  AdminPipelineResponse,
  AdminScheduleInput,
  SchedulePreset,
} from '@kawan-pasar/contracts';
import {
  Body,
  Controller,
  Get,
  Header,
  HttpCode,
  HttpStatus,
  Inject,
  Post,
  Put,
  UseGuards,
} from '@nestjs/common';
import { sql } from 'drizzle-orm';
import { z } from 'zod';
import { ApiHttpError } from '../../common/api-errors.js';
import { CLOCK } from '../../common/clock.js';
import type { Clock } from '../../common/clock.js';
import { ZodValidationPipe } from '../../common/zod-validation.pipe.js';
import type { Db } from '../../database/client.js';
import { auditLog, pipelineSettings } from '../../database/schema/index.js';
import type { AuthContext } from '../auth/auth.service.js';
import { Auth, CsrfGuard, SessionGuard } from '../auth/session.guard.js';
import {
  AirflowClient,
  AirflowRequestError,
  AirflowUnavailableError,
} from '../pipeline/airflow-client.js';
import type { AirflowDagRun, PipelineDag } from '../pipeline/airflow-client.js';
import {
  DEFAULT_SCHEDULE,
  PRESET_LABELS,
  nextTrainingDate,
  trainsOn,
} from '../pipeline/schedule.js';
import { AdminGuard, RequiresConfirmation } from './admin.guard.js';

export const PIPELINE_REPOSITORY = Symbol('PIPELINE_REPOSITORY');
export const AIRFLOW_CLIENT = Symbol('AIRFLOW_CLIENT');

const SCHEDULE_KEY = 'latih_ulang.schedule';
/** Design § 4: at most 3 retraining runs a day; the DAG enforces it too (runs-today). */
export const TRAIN_TRIGGERS_PER_DAY = 3;
const RUNS_SHOWN = 5;
const WIB_MS = 7 * 3_600_000;
const NO_STORE = 'private, no-store';

/** The WIB calendar date of an instant, and the UTC instant at which that WIB day starts. */
export function wibDay(now: Date): { date: string; startUtc: Date } {
  const date = new Date(now.getTime() + WIB_MS).toISOString().slice(0, 10);
  return { date, startUtc: new Date(Date.parse(`${date}T00:00:00Z`) - WIB_MS) };
}

const LockXcom = z.object({
  open: z.boolean(),
  data_ceiling: z.string(),
  reason: z.string(),
});

export class PipelineRepository {
  constructor(private readonly db: Db) {}

  async schedule(): Promise<SchedulePreset> {
    const rows = await this.db.execute(
      sql`SELECT value FROM pipeline_settings WHERE key = ${SCHEDULE_KEY}`,
    );
    const parsed = SchedulePresetSchema.safeParse(rows.rows[0]?.['value']);
    return parsed.success ? parsed.data : DEFAULT_SCHEDULE;
  }

  async setSchedule(preset: SchedulePreset, userId: string): Promise<void> {
    await this.db.transaction(async (tx) => {
      await tx
        .insert(pipelineSettings)
        .values({ key: SCHEDULE_KEY, value: preset, updatedBy: userId })
        .onConflictDoUpdate({
          target: pipelineSettings.key,
          set: { value: preset, updatedBy: userId, updatedAt: sql`now()` },
        });
      await tx
        .insert(auditLog)
        .values({ actorId: userId, action: 'pipeline_schedule', target: preset });
    });
  }

  /** Retraining runs whose folders must stay: candidates awaiting a decision, the active bundle. */
  async keepRunIds(): Promise<string[]> {
    const rows = await this.db.execute(sql`
      SELECT c.run_id FROM model_candidates c
      WHERE c.status = 'pending'
         OR (c.status = 'approved' AND EXISTS (
               SELECT 1 FROM forecast_artifacts a
               WHERE a.bundle_id = c.bundle_id AND a.status = 'active'))
      ORDER BY c.run_id`);
    return z
      .array(z.object({ run_id: z.string() }))
      .parse(rows.rows)
      .map((r) => r.run_id);
  }

  async retrainTriggersSince(startUtc: Date): Promise<number> {
    const rows = await this.db.execute(sql`
      SELECT count(*)::int AS n FROM audit_log
      WHERE action = 'pipeline_trigger' AND target = 'latih_ulang'
        AND created_at >= ${startUtc.toISOString()}::timestamptz`);
    return z.object({ n: z.number() }).parse(rows.rows[0]).n;
  }

  /** `at` comes from the app clock: the daily quota counts these rows by the same clock. */
  async audit(
    userId: string,
    action: 'pipeline_trigger' | 'pipeline_pause' | 'pipeline_resume',
    target: string,
    at: Date,
  ): Promise<void> {
    await this.db.insert(auditLog).values({ actorId: userId, action, target, createdAt: at });
  }
}

const airflowInactive = (): ApiHttpError =>
  new ApiHttpError(HttpStatus.SERVICE_UNAVAILABLE, 'airflow_unavailable', 'Airflow tidak aktif');
const quotaExhausted = (): ApiHttpError =>
  new ApiHttpError(
    HttpStatus.CONFLICT,
    'quota_exceeded',
    'Batas 3 latih ulang per hari sudah tercapai',
  );

/** Maps Airflow failures to API errors; everything else is rethrown. */
async function viaAirflow<T>(fn: () => Promise<T>): Promise<T> {
  try {
    return await fn();
  } catch (e) {
    if (e instanceof AirflowUnavailableError) throw airflowInactive();
    if (e instanceof AirflowRequestError) throw airflowInactive();
    throw e;
  }
}

const iso = (v: string | null | undefined): string | null =>
  v === null || v === undefined ? null : new Date(v).toISOString();

/** Used by the DAGs with the service token (like every /internal route). */
@Controller('internal/pipeline')
export class PipelineInternalController {
  constructor(
    @Inject(PIPELINE_REPOSITORY) private readonly repo: PipelineRepository,
    @Inject(CLOCK) private readonly clock: Clock,
  ) {}

  /** The schedule gate of `latih_ulang` (owner ruling K2). */
  @Get('schedule')
  @Header('cache-control', NO_STORE)
  async schedule(): Promise<{
    preset: SchedulePreset;
    date: string;
    train: boolean;
    next: string | null;
  }> {
    const preset = await this.repo.schedule();
    const { date } = wibDay(this.clock.now());
    return { preset, date, train: trainsOn(preset, date), next: nextTrainingDate(preset, date) };
  }

  @Get('keep-runs')
  @Header('cache-control', NO_STORE)
  async keepRuns(): Promise<{ runIds: string[] }> {
    return { runIds: await this.repo.keepRunIds() };
  }
}

/** Pipeline page of the admin (Fase 4C): Airflow status and controls through the Core API. */
@Controller('v1/admin/pipeline')
@UseGuards(SessionGuard, CsrfGuard, AdminGuard)
export class AdminPipelineController {
  constructor(
    @Inject(PIPELINE_REPOSITORY) private readonly repo: PipelineRepository,
    @Inject(AIRFLOW_CLIENT) private readonly airflow: AirflowClient,
    @Inject(CLOCK) private readonly clock: Clock,
  ) {}

  @Get()
  @Header('cache-control', NO_STORE)
  async overview(): Promise<AdminPipelineResponse> {
    const now = this.clock.now();
    const { date, startUtc } = wibDay(now);
    const [preset, used] = await Promise.all([
      this.repo.schedule(),
      this.repo.retrainTriggersSince(startUtc),
    ]);
    const base: AdminPipelineResponse = {
      airflow: 'inactive',
      lock: null,
      schedule: { preset, label: PRESET_LABELS[preset], next: nextTrainingDate(preset, date) },
      triggersToday: { used, limit: TRAIN_TRIGGERS_PER_DAY },
      dags: [],
    };
    if (!this.airflow.configured) return base;
    try {
      const [lock, daily, train] = await Promise.all([
        this.lockStatus(),
        this.dagView('harga_harian'),
        this.dagView('latih_ulang'),
      ]);
      return { ...base, airflow: 'active', lock, dags: [daily, train] };
    } catch (e) {
      if (e instanceof AirflowUnavailableError || e instanceof AirflowRequestError) return base;
      throw e;
    }
  }

  @Post('trigger')
  @HttpCode(202)
  @Header('cache-control', NO_STORE)
  @RequiresConfirmation()
  async trigger(
    @Auth() auth: AuthContext,
    @Body(new ZodValidationPipe(AdminPipelineDagInputSchema)) body: AdminPipelineDagInput,
  ): Promise<{ runId: string }> {
    if (!this.airflow.configured) throw airflowInactive();
    if (body.dag === 'latih_ulang') {
      const used = await this.repo.retrainTriggersSince(wibDay(this.clock.now()).startUtc);
      if (used >= TRAIN_TRIGGERS_PER_DAY) throw quotaExhausted();
    }
    // Manual retraining also verifies while the lock holds (data ≤ 30 Sep 2026, protocol § 4);
    // the pipeline evaluates the lock again when it prepares the run.
    const conf = body.dag === 'latih_ulang' ? { even_if_locked: true } : {};
    const runId = await viaAirflow(() => this.airflow.trigger(body.dag, conf));
    await this.repo.audit(auth.session.userId, 'pipeline_trigger', body.dag, this.clock.now());
    return { runId };
  }

  @Post('pause')
  @HttpCode(204)
  @Header('cache-control', NO_STORE)
  @RequiresConfirmation()
  async pause(
    @Auth() auth: AuthContext,
    @Body(new ZodValidationPipe(AdminPipelineDagInputSchema)) body: AdminPipelineDagInput,
  ): Promise<void> {
    if (!this.airflow.configured) throw airflowInactive();
    await viaAirflow(() => this.airflow.setPaused(body.dag, true));
    await this.repo.audit(auth.session.userId, 'pipeline_pause', body.dag, this.clock.now());
  }

  @Post('resume')
  @HttpCode(204)
  @Header('cache-control', NO_STORE)
  @RequiresConfirmation()
  async resume(
    @Auth() auth: AuthContext,
    @Body(new ZodValidationPipe(AdminPipelineDagInputSchema)) body: AdminPipelineDagInput,
  ): Promise<void> {
    if (!this.airflow.configured) throw airflowInactive();
    await viaAirflow(() => this.airflow.setPaused(body.dag, false));
    await this.repo.audit(auth.session.userId, 'pipeline_resume', body.dag, this.clock.now());
  }

  @Put('schedule')
  @HttpCode(204)
  @Header('cache-control', NO_STORE)
  @RequiresConfirmation()
  async setSchedule(
    @Auth() auth: AuthContext,
    @Body(new ZodValidationPipe(AdminScheduleInputSchema)) body: AdminScheduleInput,
  ): Promise<void> {
    await this.repo.setSchedule(body.preset, auth.session.userId);
  }

  /** The last successful `status_kunci` run's result (hourly). */
  private async lockStatus(): Promise<AdminPipelineResponse['lock']> {
    const runs = await this.airflow.runs('status_kunci', 5);
    const done = runs.find((r) => r.state === 'success');
    if (done === undefined) return null;
    const parsed = LockXcom.safeParse(
      await this.airflow.taskResult('status_kunci', done.dag_run_id, 'status'),
    );
    if (!parsed.success) return null;
    const ceiling = /^\d{4}-\d{2}-\d{2}$/.test(parsed.data.data_ceiling)
      ? parsed.data.data_ceiling
      : null;
    return {
      open: parsed.data.open,
      dataCeiling: ceiling,
      reason: parsed.data.reason,
      checkedAt: iso(done.end_date),
    };
  }

  private async dagView(
    id: 'harga_harian' | 'latih_ulang',
  ): Promise<AdminPipelineResponse['dags'][number]> {
    const [dag, runs] = await Promise.all([
      this.airflow.dag(id),
      this.airflow.runs(id, RUNS_SHOWN),
    ]);
    const withTasks = await Promise.all(runs.map((r) => this.runView(id, r)));
    return { id, paused: dag.is_paused, runs: withTasks };
  }

  private async runView(
    id: PipelineDag,
    r: AirflowDagRun,
  ): Promise<AdminPipelineResponse['dags'][number]['runs'][number]> {
    const tasks = await this.airflow.taskInstances(id, r.dag_run_id);
    return {
      runId: r.dag_run_id,
      state: r.state,
      runType: r.run_type,
      runAfter: iso(r.run_after),
      startedAt: iso(r.start_date),
      endedAt: iso(r.end_date),
      tasks: tasks.map((t) => ({
        id: t.task_id,
        state: t.state,
        durationSeconds:
          t.duration === null || t.duration === undefined ? null : Math.round(t.duration),
      })),
    };
  }
}
