// Readiness (docs 13 §A9): each dependency is checked with a 1 s timeout. Only Postgres is
// critical; without Valkey or the model the product still serves prices and costs (AP-08).

export type DependencyCheck = {
  readonly name: string;
  readonly critical: boolean;
  readonly run: (signal: AbortSignal) => Promise<unknown>;
};

export type CheckStatus = 'ok' | 'down';
export type ReadinessReport = {
  status: 'ok' | 'degraded' | 'down';
  checks: Record<string, CheckStatus>;
};

export const CHECK_TIMEOUT_MS = 1000;

async function probe(check: DependencyCheck, timeoutMs: number): Promise<CheckStatus> {
  const signal = AbortSignal.timeout(timeoutMs);
  const timedOut = new Promise<never>((_resolve, reject) => {
    signal.addEventListener('abort', () => {
      reject(new Error('timeout'));
    });
  });
  try {
    await Promise.race([check.run(signal), timedOut]);
    return 'ok';
  } catch {
    return 'down';
  }
}

export async function assessReadiness(
  checks: readonly DependencyCheck[],
  timeoutMs = CHECK_TIMEOUT_MS,
): Promise<ReadinessReport> {
  const results = await Promise.all(
    checks.map(async (check) => ({ check, status: await probe(check, timeoutMs) })),
  );
  const failed = results.filter((result) => result.status !== 'ok');
  const status = failed.some((result) => result.check.critical)
    ? 'down'
    : failed.length > 0
      ? 'degraded'
      : 'ok';
  const entries = results.map((result) => [result.check.name, result.status] as const);
  return { status, checks: Object.fromEntries(entries) };
}
