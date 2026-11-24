import 'server-only';
import {
  AdminModelCandidateDetailSchema,
  AdminModelCandidatesResponseSchema,
  AdminModelRejectResponseSchema,
  AdminPipelineResponseSchema,
  AdminArticleListResponseSchema,
  AdminArticleResponseSchema,
  AdminArticleSavedSchema,
  AdminMonitoringResponseSchema,
  AdminRequestsResponseSchema,
  AdminStatusResponseSchema,
  AdminUserSearchResponseSchema,
  AlertsResponseSchema,
  AnalystStatusResponseSchema,
  ApiErrorSchema,
  LoginResponseSchema,
  NotificationsResponseSchema,
  UnreadCountResponseSchema,
  WhatsAppResponseSchema,
  MeResponseSchema,
  SessionsResponseSchema,
} from '@kawan-pasar/contracts';
import type {
  AdminModelCandidateDetail,
  AdminModelCandidatesResponse,
  AdminModelRejectResponse,
  AdminPipelineDag,
  AdminPipelineResponse,
  SchedulePreset,
  AdminArticleCreate,
  AdminArticleListResponse,
  AdminArticleResponse,
  AdminArticleRestore,
  AdminArticleSaved,
  AdminArticleUpdate,
  AdminDecisionInput,
  AdminMonitoringResponse,
  AdminRequestsResponse,
  AdminStatusResponse,
  AdminUserSearchResponse,
  AlertPreferences,
  AnalystRequestInput,
  AnalystStatusResponse,
  AlertsResponse,
  ApiErrorCode,
  MarkReadInput,
  NotificationTab,
  NotificationsResponse,
  WatchInput,
  WatchUpdate,
  WhatsAppResponse,
  ChangePasswordInput,
  DeleteAccountInput,
  ForgotInput,
  LoginInput,
  LoginResponse,
  MeResponse,
  PhoneInput,
  RegisterInput,
  ResetInput,
  SessionsResponse,
} from '@kawan-pasar/contracts';
import { headers } from 'next/headers';
import type { z } from 'zod';
import { serverEnv } from '../env';
import { log } from '../log';

export interface AuthFailure {
  ok: false;
  code: ApiErrorCode | 'unavailable';
  /** Policy rule or reason from the API (never user input). */
  reason?: string;
  fields?: string[];
  retryAfter?: number;
}
export type AuthResult<T> = { ok: true; data: T } | AuthFailure;

/** Argon2 runs on sign-in and password changes: allow more than a data read. */
const TIMEOUT_MS = 8_000;

interface CallOptions {
  body?: unknown;
  session?: string;
  csrf?: string;
}

/**
 * Account calls to the Core API. Never cached (`no-store`): account data is personal. Forwards
 * the visitor's address (set by Traefik) so the API's per-client limits apply to the visitor,
 * not to the web server.
 */
async function call<S extends z.ZodType | null>(
  method: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE',
  path: string,
  schema: S,
  options: CallOptions = {},
): Promise<AuthResult<S extends z.ZodType ? z.infer<S> : null>> {
  const env = serverEnv();
  const incoming = await headers();
  const forwardedFor = (incoming.get('x-forwarded-for') ?? '').split(',')[0]?.trim() ?? '';
  const sent = new Headers({
    'x-service-token': env.SERVICE_TOKEN,
    accept: 'application/json',
    'x-forwarded-for': forwardedFor === '' ? '0.0.0.0' : forwardedFor,
    'user-agent': (incoming.get('user-agent') ?? '').slice(0, 400),
  });
  if (options.body !== undefined) sent.set('content-type', 'application/json');
  if (options.session !== undefined) sent.set('x-session-token', options.session);
  if (options.csrf !== undefined) sent.set('x-csrf-token', options.csrf);

  let res: Response;
  try {
    res = await fetch(new URL(path, env.API_INTERNAL_URL), {
      method,
      headers: sent,
      cache: 'no-store',
      signal: AbortSignal.timeout(TIMEOUT_MS),
      ...(options.body === undefined ? {} : { body: JSON.stringify(options.body) }),
    });
  } catch (e) {
    log('warn', 'account api request failed', {
      path,
      reason: e instanceof Error ? e.name : 'unknown',
    });
    return { ok: false, code: 'unavailable' };
  }

  if (res.ok) {
    if (schema === null || res.status === 204) {
      return { ok: true, data: null } as AuthResult<S extends z.ZodType ? z.infer<S> : null>;
    }
    const parsed = schema.safeParse(await res.json().catch(() => undefined));
    if (!parsed.success) {
      log('error', 'account api response breaks the contract', { path });
      return { ok: false, code: 'unavailable' };
    }
    return { ok: true, data: parsed.data } as AuthResult<S extends z.ZodType ? z.infer<S> : null>;
  }
  const error = ApiErrorSchema.safeParse(await res.json().catch(() => undefined));
  if (!error.success) return { ok: false, code: 'unavailable' };
  const retry = Number(res.headers.get('retry-after'));
  return {
    ok: false,
    code: error.data.error.code,
    reason: error.data.error.message,
    ...(error.data.error.fields === undefined ? {} : { fields: error.data.error.fields }),
    ...(Number.isFinite(retry) && retry > 0 ? { retryAfter: retry } : {}),
  };
}

type Done = Promise<AuthResult<null>>;

/** The only place that knows the account paths of the Core API. */
export const authApi = {
  register: (input: RegisterInput): Done =>
    call('POST', '/v1/auth/register', null, { body: input }),
  /** `previous`: this browser's current session, ended by the API on success. */
  login: (input: LoginInput, previous?: string): Promise<AuthResult<LoginResponse>> =>
    call('POST', '/v1/auth/login', LoginResponseSchema, {
      body: input,
      ...(previous === undefined ? {} : { session: previous }),
    }),
  logout: (session: string, csrf: string): Done =>
    call('POST', '/v1/auth/logout', null, { session, csrf }),
  verifyEmail: (token: string): Done =>
    call('POST', '/v1/auth/verify-email', null, { body: { token } }),
  resendVerification: (session: string, csrf: string): Done =>
    call('POST', '/v1/auth/resend-verification', null, { session, csrf }),
  forgotPassword: (input: ForgotInput): Done =>
    call('POST', '/v1/auth/forgot-password', null, { body: input }),
  resetPassword: (input: ResetInput): Done =>
    call('POST', '/v1/auth/reset-password', null, { body: input }),
  me: (session: string): Promise<AuthResult<MeResponse>> =>
    call('GET', '/v1/me', MeResponseSchema, { session }),
  sessions: (session: string): Promise<AuthResult<SessionsResponse>> =>
    call('GET', '/v1/me/sessions', SessionsResponseSchema, { session }),
  changePassword: (session: string, csrf: string, input: ChangePasswordInput): Done =>
    call('POST', '/v1/me/password', null, { session, csrf, body: input }),
  setPhone: (session: string, csrf: string, input: PhoneInput): Done =>
    call('PUT', '/v1/me/phone', null, { session, csrf, body: input }),
  removePhone: (session: string, csrf: string): Done =>
    call('DELETE', '/v1/me/phone', null, { session, csrf }),
  revokeSession: (session: string, csrf: string, id: string): Done =>
    call('DELETE', `/v1/me/sessions/${encodeURIComponent(id)}`, null, { session, csrf }),
  deleteAccount: (session: string, csrf: string, input: DeleteAccountInput): Done =>
    call('DELETE', '/v1/me', null, { session, csrf, body: input }),
};

/** Alert settings, watches and in-app news (Fase 2B). Same transport as the account calls. */
export const alertsApi = {
  overview: (session: string): Promise<AuthResult<AlertsResponse>> =>
    call('GET', '/v1/alerts', AlertsResponseSchema, { session }),
  savePreferences: (session: string, csrf: string, input: AlertPreferences): Done =>
    call('PUT', '/v1/alerts/preferences', null, { session, csrf, body: input }),
  addWatch: (session: string, csrf: string, input: WatchInput): Done =>
    call('POST', '/v1/alerts/watches', null, { session, csrf, body: input }),
  updateWatch: (session: string, csrf: string, id: number, input: WatchUpdate): Done =>
    call('PATCH', `/v1/alerts/watches/${String(id)}`, null, { session, csrf, body: input }),
  removeWatch: (session: string, csrf: string, id: number): Done =>
    call('DELETE', `/v1/alerts/watches/${String(id)}`, null, { session, csrf }),
  notifications: (
    session: string,
    tab: NotificationTab,
    before?: number,
  ): Promise<AuthResult<NotificationsResponse>> =>
    call(
      'GET',
      `/v1/notifications?tab=${tab}${before === undefined ? '' : `&before=${String(before)}`}`,
      NotificationsResponseSchema,
      { session },
    ),
  unreadCount: (session: string): Promise<AuthResult<{ unread: number }>> =>
    call('GET', '/v1/notifications/unread-count', UnreadCountResponseSchema, { session }),
  markRead: (session: string, csrf: string, input: MarkReadInput): Done =>
    call('POST', '/v1/notifications/read', null, { session, csrf, body: input }),
  unsubscribeWeekly: (token: string): Done =>
    call('POST', '/v1/alerts/weekly/unsubscribe', null, { body: { token } }),
};

/** The WhatsApp channel (Fase 2C, local mock adapter). */
export const whatsappApi = {
  status: (session: string): Promise<AuthResult<WhatsAppResponse>> =>
    call('GET', '/v1/whatsapp', WhatsAppResponseSchema, { session }),
  sendCode: (session: string, csrf: string): Done =>
    call('POST', '/v1/whatsapp/code', null, { session, csrf }),
  verify: (session: string, csrf: string, code: string): Done =>
    call('POST', '/v1/whatsapp/verify', null, { session, csrf, body: { code } }),
  disconnect: (session: string, csrf: string): Done =>
    call('DELETE', '/v1/whatsapp', null, { session, csrf }),
};

/** Mode Analis role and request (Fase 3A). CSV downloads go through app/analis/unduh. */
export const analystApi = {
  status: (session: string): Promise<AuthResult<AnalystStatusResponse>> =>
    call('GET', '/v1/analyst', AnalystStatusResponseSchema, { session }),
  request: (session: string, csrf: string, input: AnalystRequestInput): Done =>
    call('POST', '/v1/analyst/request', null, { session, csrf, body: input }),
};

/** Admin pages (Fase 3B). Every change needs a password confirmation from the last 10 minutes. */
export const adminApi = {
  status: (session: string): Promise<AuthResult<AdminStatusResponse>> =>
    call('GET', '/v1/admin', AdminStatusResponseSchema, { session }),
  confirm: (session: string, csrf: string, password: string): Done =>
    call('POST', '/v1/admin/confirm', null, { session, csrf, body: { password } }),
  requests: (session: string): Promise<AuthResult<AdminRequestsResponse>> =>
    call('GET', '/v1/admin/requests', AdminRequestsResponseSchema, { session }),
  decide: (session: string, csrf: string, id: number, input: AdminDecisionInput): Done =>
    call('POST', `/v1/admin/requests/${String(id)}/decision`, null, { session, csrf, body: input }),
  searchUser: (
    session: string,
    csrf: string,
    email: string,
  ): Promise<AuthResult<AdminUserSearchResponse>> =>
    call('POST', '/v1/admin/users/search', AdminUserSearchResponseSchema, {
      session,
      csrf,
      body: { email },
    }),
  revokeAnalyst: (session: string, csrf: string, id: string): Done =>
    call('POST', `/v1/admin/users/${encodeURIComponent(id)}/revoke-analyst`, null, {
      session,
      csrf,
    }),
  monitoring: (session: string): Promise<AuthResult<AdminMonitoringResponse>> =>
    call('GET', '/v1/admin/monitoring', AdminMonitoringResponseSchema, { session }),
  articles: (session: string): Promise<AuthResult<AdminArticleListResponse>> =>
    call('GET', '/v1/admin/articles', AdminArticleListResponseSchema, { session }),
  article: (session: string, slug: string): Promise<AuthResult<AdminArticleResponse>> =>
    call('GET', `/v1/admin/articles/${encodeURIComponent(slug)}`, AdminArticleResponseSchema, {
      session,
    }),
  createArticle: (
    session: string,
    csrf: string,
    input: AdminArticleCreate,
  ): Promise<AuthResult<AdminArticleSaved>> =>
    call('POST', '/v1/admin/articles', AdminArticleSavedSchema, { session, csrf, body: input }),
  updateArticle: (
    session: string,
    csrf: string,
    slug: string,
    input: AdminArticleUpdate,
  ): Promise<AuthResult<AdminArticleSaved>> =>
    call('PUT', `/v1/admin/articles/${encodeURIComponent(slug)}`, AdminArticleSavedSchema, {
      session,
      csrf,
      body: input,
    }),
  restoreArticle: (
    session: string,
    csrf: string,
    slug: string,
    input: AdminArticleRestore,
  ): Promise<AuthResult<AdminArticleSaved>> =>
    call(
      'POST',
      `/v1/admin/articles/${encodeURIComponent(slug)}/restore`,
      AdminArticleSavedSchema,
      { session, csrf, body: input },
    ),
  publishArticle: (session: string, csrf: string, slug: string, publish: boolean): Done =>
    call(
      'POST',
      `/v1/admin/articles/${encodeURIComponent(slug)}/${publish ? 'publish' : 'unpublish'}`,
      null,
      { session, csrf },
    ),
  // --- Fase 4C: pipeline (Airflow through the Core API) and model audit ---
  pipeline: (session: string): Promise<AuthResult<AdminPipelineResponse>> =>
    call('GET', '/v1/admin/pipeline', AdminPipelineResponseSchema, { session }),
  pipelineAction: (
    session: string,
    csrf: string,
    op: 'trigger' | 'pause' | 'resume',
    dag: AdminPipelineDag,
  ): Done => call('POST', `/v1/admin/pipeline/${op}`, null, { session, csrf, body: { dag } }),
  pipelineSchedule: (session: string, csrf: string, preset: SchedulePreset): Done =>
    call('PUT', '/v1/admin/pipeline/schedule', null, { session, csrf, body: { preset } }),
  candidates: (session: string): Promise<AuthResult<AdminModelCandidatesResponse>> =>
    call('GET', '/v1/admin/model-candidates', AdminModelCandidatesResponseSchema, { session }),
  candidate: (session: string, id: number): Promise<AuthResult<AdminModelCandidateDetail>> =>
    call('GET', `/v1/admin/model-candidates/${String(id)}`, AdminModelCandidateDetailSchema, {
      session,
    }),
  approveCandidate: (session: string, csrf: string, id: number): Done =>
    call('POST', `/v1/admin/model-candidates/${String(id)}/approve`, null, { session, csrf }),
  rejectCandidate: (
    session: string,
    csrf: string,
    id: number,
    note: string,
  ): Promise<AuthResult<AdminModelRejectResponse>> =>
    call(
      'POST',
      `/v1/admin/model-candidates/${String(id)}/reject`,
      AdminModelRejectResponseSchema,
      {
        session,
        csrf,
        body: { note },
      },
    ),
};
