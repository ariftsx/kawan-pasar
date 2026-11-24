import { z } from 'zod';
import { EmailSchema } from './auth.js';
import { ArticleCategorySchema, ArticleSlugSchema } from './articles.js';
import { CommodityCodeSchema, IsoDate, IsoDateTime } from './common.js';

// Admin (Fase 3B). Validated in the BFF and again in the API.

/** The admin's own session state: until when changes are allowed without a new confirmation. */
export const AdminStatusResponseSchema = z.strictObject({
  confirmedUntil: IsoDateTime.nullable(),
});
export type AdminStatusResponse = z.infer<typeof AdminStatusResponseSchema>;

export const AdminConfirmInputSchema = z.strictObject({
  password: z.string().min(1).max(256),
});
export type AdminConfirmInput = z.infer<typeof AdminConfirmInputSchema>;

/** "sari@contoh.id" → "s***@contoh.id": enough to recognise, not to harvest. */
export function maskEmail(email: string): string {
  const at = email.lastIndexOf('@');
  if (at <= 0) return '***';
  return `${email.slice(0, 1)}***${email.slice(at)}`;
}

export const AdminRequestItemSchema = z.strictObject({
  id: z.int().positive(),
  email: z.string(),
  reason: z.string(),
  organization: z.string().nullable(),
  createdAt: IsoDateTime,
});
export const AdminRequestsResponseSchema = z.strictObject({
  items: z.array(AdminRequestItemSchema),
});
export type AdminRequestsResponse = z.infer<typeof AdminRequestsResponseSchema>;

export const AdminDecisionInputSchema = z.strictObject({
  decision: z.enum(['approve', 'reject']),
  /** Shown to the user when rejected. */
  note: z.string().trim().min(1).max(500).optional(),
});
export type AdminDecisionInput = z.infer<typeof AdminDecisionInputSchema>;

/** Exact address only: the admin cannot list accounts by prefix (no enumeration). In a body, never a URL. */
export const AdminUserSearchInputSchema = z.strictObject({ email: EmailSchema });
export type AdminUserSearchInput = z.infer<typeof AdminUserSearchInputSchema>;

export const AdminUserSchema = z.strictObject({
  id: z.uuid(),
  email: z.string(),
  role: z.enum(['user', 'analyst', 'admin']),
  emailVerified: z.boolean(),
  createdAt: IsoDateTime,
});
export const AdminUserSearchResponseSchema = z.strictObject({ user: AdminUserSchema.nullable() });
export type AdminUserSearchResponse = z.infer<typeof AdminUserSearchResponseSchema>;

/** Read-only operations view (task 5): counts and statuses, never job contents. */
export const AdminMonitoringResponseSchema = z.strictObject({
  ingestRuns: z.array(
    z.strictObject({
      id: z.int(),
      source: z.string(),
      status: z.enum(['running', 'succeeded', 'partial', 'failed']),
      startedAt: IsoDateTime,
      finishedAt: IsoDateTime.nullable(),
      rowsInserted: z.int(),
      rowsSkipped: z.int(),
      rowsRejected: z.int(),
      error: z.string().max(300).nullable(),
    }),
  ),
  bundles: z.array(
    z.strictObject({
      bundleId: z.string(),
      modelName: z.string(),
      modelVersion: z.string(),
      status: z.enum(['pending', 'active', 'retired', 'rejected']),
      isDemo: z.boolean(),
      issuedAt: IsoDateTime,
      ageDays: z.int().nonnegative(),
      rejectReasons: z.array(z.string()),
    }),
  ),
  queues: z.array(
    z.strictObject({
      name: z.enum(['mail', 'alerts', 'whatsapp']),
      waiting: z.int().nonnegative(),
      active: z.int().nonnegative(),
      delayed: z.int().nonnegative(),
      failed: z.int().nonnegative(),
    }),
  ),
});
export type AdminMonitoringResponse = z.infer<typeof AdminMonitoringResponseSchema>;

// Articles (task 6). Body safety (links, images, size) is checked with the Markdown parser in
// `@kawan-pasar/contracts/article-body`; these schemas cover the fields.

const ArticleFields = {
  category: ArticleCategorySchema,
  title: z.string().trim().min(1).max(120),
  summary: z.string().trim().min(1).max(300),
  /** The real limit is 50 KB of UTF-8 (article-body); this only bounds the request. */
  bodyMd: z.string().min(1).max(60_000),
};

export const AdminArticleCreateSchema = z.strictObject({
  slug: ArticleSlugSchema,
  ...ArticleFields,
});
export type AdminArticleCreate = z.infer<typeof AdminArticleCreateSchema>;

/** A save names the revision it edited: a stale save (someone saved meanwhile) is refused. */
export const AdminArticleUpdateSchema = z.strictObject({
  ...ArticleFields,
  baseRevision: z.int().positive(),
});
export type AdminArticleUpdate = z.infer<typeof AdminArticleUpdateSchema>;

export const AdminArticleRestoreSchema = z.strictObject({
  revision: z.int().positive(),
  baseRevision: z.int().positive(),
});
export type AdminArticleRestore = z.infer<typeof AdminArticleRestoreSchema>;

export const AdminArticleSavedSchema = z.strictObject({ revision: z.int().positive() });
export type AdminArticleSaved = z.infer<typeof AdminArticleSavedSchema>;

export const AdminArticleListResponseSchema = z.strictObject({
  items: z.array(
    z.strictObject({
      slug: z.string(),
      title: z.string(),
      category: ArticleCategorySchema,
      status: z.enum(['draft', 'published']),
      revision: z.int(),
      updatedAt: IsoDateTime,
    }),
  ),
});
export type AdminArticleListResponse = z.infer<typeof AdminArticleListResponseSchema>;

export const AdminArticleResponseSchema = z.strictObject({
  slug: z.string(),
  category: ArticleCategorySchema,
  title: z.string(),
  summary: z.string(),
  bodyMd: z.string(),
  readingMinutes: z.int(),
  revision: z.int(),
  published: z.boolean(),
  publishedAt: IsoDateTime.nullable(),
  updatedAt: IsoDateTime,
  /** Newest first, at most 50. `by` is a masked e-mail (null when imported or deleted). */
  revisions: z.array(
    z.strictObject({ revision: z.int(), createdAt: IsoDateTime, by: z.string().nullable() }),
  ),
});
export type AdminArticleResponse = z.infer<typeof AdminArticleResponseSchema>;

// Model candidates (Fase 4B task 5): registered by the retraining pipeline (Airflow), audited and
// decided by an admin (4C). A candidate is never active until an admin approves it.

const RelMae = z.number().nonnegative().max(100);
const RUN_ID = /^[A-Za-z0-9][A-Za-z0-9._-]{0,63}$/;
/** ARIF-Net prospective-test protocol v1.1.0: the data ceiling while the test is not opened. */
export const PROSPECTIVE_LOCKED_DATA_END = '2026-09-30';

export const ModelCandidateInputSchema = z
  .strictObject({
    runId: z.string().regex(RUN_ID),
    bundleId: z.string().regex(/^arifnet-[a-z0-9._-]{1,120}$/),
    bundleSha256: z.string().regex(/^[0-9a-f]{64}$/),
    modelVersion: z.string().min(1).max(120),
    dataEnd: IsoDate,
    /** The prospective-test lock when the run was made. */
    lockOpen: z.boolean(),
    commodities: z.array(CommodityCodeSchema).min(1).max(10),
    overallRelmae: RelMae,
    /** relMAE per product commodity code and horizon (days). */
    // partialRecord: an enum-keyed z.record is exhaustive in zod 4 (every commodity required).
    scores: z.partialRecord(CommodityCodeSchema, z.record(z.string().regex(/^\d{1,3}$/), RelMae)),
    window: z.strictObject({ start: IsoDate, end: IsoDate }),
  })
  // A candidate trained while the lock was closed cannot have data after the ceiling.
  .refine((c) => c.lockOpen || c.dataEnd <= PROSPECTIVE_LOCKED_DATA_END, {
    path: ['dataEnd'],
    message: 'data after the prospective-test ceiling while the lock was closed',
  });
export type ModelCandidateInput = z.infer<typeof ModelCandidateInputSchema>;

export const ModelCandidateStatusSchema = z.enum(['pending', 'approved', 'rejected']);

export const AdminModelCandidatesResponseSchema = z.strictObject({
  items: z.array(
    z.strictObject({
      id: z.int().positive(),
      runId: z.string(),
      bundleId: z.string(),
      modelVersion: z.string(),
      dataEnd: IsoDate,
      lockOpen: z.boolean(),
      commodities: z.array(CommodityCodeSchema),
      overallRelmae: z.number(),
      scores: z.record(z.string(), z.record(z.string(), z.number())),
      window: z.strictObject({ start: IsoDate, end: IsoDate }),
      status: ModelCandidateStatusSchema,
      createdAt: IsoDateTime,
    }),
  ),
});
export type AdminModelCandidatesResponse = z.infer<typeof AdminModelCandidatesResponseSchema>;

// --- Fase 4C: pipeline (Airflow) and model audit pages -------------------------------------------

export const SchedulePresetSchema = z.enum([
  'weekly_monday',
  'daily',
  'biweekly_monday',
  'monthly_first_monday',
  'manual',
]);
export type SchedulePreset = z.infer<typeof SchedulePresetSchema>;

export const AdminScheduleInputSchema = z.strictObject({ preset: SchedulePresetSchema });
export type AdminScheduleInput = z.infer<typeof AdminScheduleInputSchema>;

/** DAGs an admin may trigger, pause or resume (status_kunci is internal). */
export const AdminPipelineDagSchema = z.enum(['harga_harian', 'latih_ulang']);
export type AdminPipelineDag = z.infer<typeof AdminPipelineDagSchema>;

export const AdminPipelineDagInputSchema = z.strictObject({ dag: AdminPipelineDagSchema });
export type AdminPipelineDagInput = z.infer<typeof AdminPipelineDagInputSchema>;

const PipelineTaskSchema = z.strictObject({
  id: z.string(),
  state: z.string().nullable(),
  durationSeconds: z.number().nullable(),
});

const PipelineRunSchema = z.strictObject({
  runId: z.string(),
  state: z.string().nullable(),
  runType: z.string(),
  runAfter: IsoDateTime.nullable(),
  startedAt: IsoDateTime.nullable(),
  endedAt: IsoDateTime.nullable(),
  tasks: z.array(PipelineTaskSchema),
});

export const AdminPipelineResponseSchema = z.strictObject({
  /** `inactive`: Airflow is not configured or not answering; the rest is then empty. */
  airflow: z.enum(['active', 'inactive']),
  lock: z
    .strictObject({
      open: z.boolean(),
      dataCeiling: IsoDate.nullable(),
      reason: z.string(),
      checkedAt: IsoDateTime.nullable(),
    })
    .nullable(),
  schedule: z.strictObject({
    preset: SchedulePresetSchema,
    label: z.string(),
    next: IsoDate.nullable(),
  }),
  /** Retraining runs triggered from the admin today (WIB), out of `limit`. */
  triggersToday: z.strictObject({ used: z.int().nonnegative(), limit: z.int().positive() }),
  dags: z.array(
    z.strictObject({
      id: AdminPipelineDagSchema,
      paused: z.boolean(),
      runs: z.array(PipelineRunSchema),
    }),
  ),
});
export type AdminPipelineResponse = z.infer<typeof AdminPipelineResponseSchema>;

export const ModelCandidateBlockerSchema = z.enum([
  'locked',
  'quality',
  'runtime',
  'expired',
  'decided',
  'files',
  // A newer bundle of the same model is already active: this one would replace newer forecasts.
  'superseded',
]);
export type ModelCandidateBlocker = z.infer<typeof ModelCandidateBlockerSchema>;

const QuantilesSchema = z.strictObject({
  q10: z.int().nullable(),
  q50: z.int().nullable(),
  q90: z.int().nullable(),
});

export const AdminModelCandidateDetailSchema = z.strictObject({
  candidate: AdminModelCandidatesResponseSchema.shape.items.element.extend({
    note: z.string().nullable(),
    decidedAt: IsoDateTime.nullable(),
  }),
  audit: z.strictObject({
    /** The promotion verifier on the bundle files, without writing anything. */
    runtime: z.strictObject({ ok: z.boolean(), reasons: z.array(z.string()) }),
    quality: z.strictObject({
      overall: z.number(),
      pass: z.boolean(),
      /** The active ARIF-Net candidate's score, when there is one. */
      activeOverall: z.number().nullable(),
    }),
    /** Median and range in rupiah at 7, 30 and 90 days, for a human check. */
    samples: z.array(
      z.strictObject({
        commodity: CommodityCodeSchema,
        basePriceIdr: z.int().nullable(),
        h7: QuantilesSchema,
        h30: QuantilesSchema,
        h90: QuantilesSchema,
      }),
    ),
    issuedAt: IsoDateTime.nullable(),
    blockers: z.array(ModelCandidateBlockerSchema),
  }),
});
export type AdminModelCandidateDetail = z.infer<typeof AdminModelCandidateDetailSchema>;

export const AdminModelRejectInputSchema = z.strictObject({
  note: z.string().trim().min(3).max(500),
});
export type AdminModelRejectInput = z.infer<typeof AdminModelRejectInputSchema>;

export const AdminModelRejectResponseSchema = z.strictObject({
  /** Whether a new retraining run was triggered (only with the lock open and quota left, K4). */
  retrain: z.enum(['triggered', 'locked', 'quota', 'airflow_inactive']),
});
export type AdminModelRejectResponse = z.infer<typeof AdminModelRejectResponseSchema>;
