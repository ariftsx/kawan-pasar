import { z } from 'zod';

/**
 * Apache Airflow REST API v2 client (Fase 4C, ADR 0017). Only the Core API talks to Airflow, on
 * the backend network, as the `kawanpasar-api` user (SimpleAuthManager role `user`). Browsers
 * never reach Airflow. Only the Kawan Pasar DAGs can be addressed.
 */
export const AIRFLOW_USER = 'kawanpasar-api';
export const PIPELINE_DAGS = ['harga_harian', 'latih_ulang', 'status_kunci'] as const;
export type PipelineDag = (typeof PIPELINE_DAGS)[number];

const TIMEOUT_MS = 5_000;
/** Refresh the JWT this long before it expires. */
const TOKEN_MARGIN_MS = 60_000;
/** Used when the token carries no readable expiry. */
const TOKEN_FALLBACK_MS = 10 * 60_000;

/** Airflow is not configured, not running, or not answering: shown as "Airflow tidak aktif". */
export class AirflowUnavailableError extends Error {
  constructor(reason: string) {
    super(`airflow unavailable: ${reason}`);
    this.name = 'AirflowUnavailableError';
  }
}

/** Airflow answered with an unexpected status (bad request, forbidden, not found). */
export class AirflowRequestError extends Error {
  constructor(readonly status: number) {
    super(`airflow refused the request: HTTP ${String(status)}`);
    this.name = 'AirflowRequestError';
  }
}

const Dag = z.object({
  dag_id: z.string(),
  is_paused: z.boolean(),
  next_dagrun_run_after: z.string().nullable().optional(),
});
export type AirflowDag = z.infer<typeof Dag>;

const DagRun = z.object({
  dag_run_id: z.string(),
  state: z.string().nullable(),
  run_type: z.string(),
  run_after: z.string().nullable().optional(),
  start_date: z.string().nullable().optional(),
  end_date: z.string().nullable().optional(),
  conf: z.record(z.string(), z.unknown()).nullable().optional(),
});
export type AirflowDagRun = z.infer<typeof DagRun>;
const DagRuns = z.object({ dag_runs: z.array(DagRun) });

const TaskInstance = z.object({
  task_id: z.string(),
  state: z.string().nullable(),
  duration: z.number().nullable().optional(),
});
export type AirflowTaskInstance = z.infer<typeof TaskInstance>;
const TaskInstances = z.object({ task_instances: z.array(TaskInstance) });

const Xcom = z.object({ value: z.unknown() });
const Token = z.object({ access_token: z.string().min(1) });

export interface AirflowTarget {
  readonly url: string;
  readonly password: string;
}

function tokenExpiry(token: string, now: number): number {
  const payload = token.split('.')[1];
  if (payload !== undefined) {
    try {
      const exp = z
        .object({ exp: z.number() })
        .safeParse(JSON.parse(Buffer.from(payload, 'base64url').toString('utf8')));
      if (exp.success) return exp.data.exp * 1000;
    } catch {
      // fall through to the fallback lifetime
    }
  }
  return now + TOKEN_FALLBACK_MS;
}

export class AirflowClient {
  private token: { value: string; expiresAt: number } | null = null;

  constructor(
    private readonly target: AirflowTarget | null,
    private readonly fetchFn: typeof fetch = fetch,
    private readonly now: () => number = Date.now,
  ) {}

  get configured(): boolean {
    return this.target !== null;
  }

  async dag(dagId: PipelineDag): Promise<AirflowDag> {
    return Dag.parse(await this.call('GET', `/api/v2/dags/${dagId}`));
  }

  async runs(dagId: PipelineDag, limit = 10): Promise<AirflowDagRun[]> {
    const query = new URLSearchParams({ limit: String(limit), order_by: '-run_after' });
    return DagRuns.parse(
      await this.call('GET', `/api/v2/dags/${dagId}/dagRuns?${query.toString()}`),
    ).dag_runs;
  }

  async taskInstances(dagId: PipelineDag, runId: string): Promise<AirflowTaskInstance[]> {
    const path = `/api/v2/dags/${dagId}/dagRuns/${encodeURIComponent(runId)}/taskInstances`;
    return TaskInstances.parse(await this.call('GET', path)).task_instances;
  }

  /** The return value of a task (XCom `return_value`), or null when it has none. */
  async taskResult(dagId: PipelineDag, runId: string, taskId: string): Promise<unknown> {
    const path =
      `/api/v2/dags/${dagId}/dagRuns/${encodeURIComponent(runId)}` +
      `/taskInstances/${encodeURIComponent(taskId)}/xcomEntries/return_value`;
    try {
      return Xcom.parse(await this.call('GET', path)).value;
    } catch (e) {
      if (e instanceof AirflowRequestError && e.status === 404) return null;
      throw e;
    }
  }

  async trigger(dagId: PipelineDag, conf: Record<string, unknown> = {}): Promise<string> {
    const body = { logical_date: null, conf };
    return DagRun.parse(await this.call('POST', `/api/v2/dags/${dagId}/dagRuns`, body)).dag_run_id;
  }

  async setPaused(dagId: PipelineDag, paused: boolean): Promise<void> {
    await this.call('PATCH', `/api/v2/dags/${dagId}?update_mask=is_paused`, { is_paused: paused });
  }

  private async call(
    method: string,
    path: string,
    body?: unknown,
    retried = false,
  ): Promise<unknown> {
    const token = await this.accessToken();
    const res = await this.send(method, path, token, body);
    // An expired or revoked token: fetch a new one once.
    if (res.status === 401 && !retried) {
      this.token = null;
      return this.call(method, path, body, true);
    }
    if (res.status >= 500) throw new AirflowUnavailableError(`HTTP ${String(res.status)}`);
    if (!res.ok) throw new AirflowRequestError(res.status);
    return res.status === 204 ? null : await res.json();
  }

  private async accessToken(): Promise<string> {
    const now = this.now();
    if (this.token !== null && this.token.expiresAt - TOKEN_MARGIN_MS > now)
      return this.token.value;
    const target = this.requireTarget();
    const res = await this.send('POST', '/auth/token', null, {
      username: AIRFLOW_USER,
      password: target.password,
    });
    if (res.status >= 500) throw new AirflowUnavailableError(`HTTP ${String(res.status)}`);
    if (!res.ok) throw new AirflowRequestError(res.status);
    const value = Token.parse(await res.json()).access_token;
    this.token = { value, expiresAt: tokenExpiry(value, now) };
    return value;
  }

  private async send(
    method: string,
    path: string,
    token: string | null,
    body?: unknown,
  ): Promise<Response> {
    const target = this.requireTarget();
    const headers: Record<string, string> = { accept: 'application/json' };
    if (token !== null) headers['authorization'] = `Bearer ${token}`;
    if (body !== undefined) headers['content-type'] = 'application/json';
    try {
      return await this.fetchFn(new URL(path, target.url).href, {
        method,
        headers,
        ...(body === undefined ? {} : { body: JSON.stringify(body) }),
        signal: AbortSignal.timeout(TIMEOUT_MS),
        redirect: 'error',
      });
    } catch (e) {
      // Network error or timeout. The message never includes the password or the token.
      throw new AirflowUnavailableError(e instanceof Error ? e.name : 'network');
    }
  }

  private requireTarget(): AirflowTarget {
    if (this.target === null) throw new AirflowUnavailableError('not configured');
    return this.target;
  }
}
