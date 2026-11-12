import 'server-only';

type Level = 'info' | 'warn' | 'error';

/**
 * Minimal structured logger for the web server (one JSON line per event on stderr). Callers pass
 * fixed messages and identifiers only, never tokens or upstream response bodies.
 */
export function log(level: Level, msg: string, fields: Record<string, string | number> = {}): void {
  process.stderr.write(
    `${JSON.stringify({ level, time: new Date().toISOString(), service: 'web', msg, ...fields })}\n`,
  );
}
