/**
 * Rate-limited warning for cache failures. While Valkey is down every request would otherwise log
 * a line; this writes at most one JSON line per interval and counts the suppressed ones.
 */
export function createThrottledWarn(
  write: (line: string) => void,
  intervalMs = 10_000,
  now: () => number = Date.now,
): (msg: string) => void {
  let last = -Infinity;
  let suppressed = 0;
  return (msg) => {
    const t = now();
    if (t - last < intervalMs) {
      suppressed += 1;
      return;
    }
    last = t;
    write(
      JSON.stringify({
        level: 'warn',
        time: new Date(t).toISOString(),
        service: 'web',
        msg,
        ...(suppressed > 0 ? { suppressed } : {}),
      }),
    );
    suppressed = 0;
  };
}
