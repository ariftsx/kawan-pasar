import { readFileSync, writeFileSync } from 'node:fs';

/** Where the worker records that its event loop is still turning (tmpfs in the container). */
export const HEARTBEAT_FILE = '/tmp/kp-worker-heartbeat';
export const HEARTBEAT_INTERVAL_MS = 10_000;
/** Three missed beats: the container health check reports the worker as unhealthy. */
export const HEARTBEAT_MAX_AGE_MS = 30_000;

export function writeHeartbeat(file: string, now: number = Date.now()): void {
  writeFileSync(file, String(now));
}

export function isAlive(file: string, maxAgeMs: number, now: number = Date.now()): boolean {
  let beat: number;
  try {
    beat = Number(readFileSync(file, 'utf8'));
  } catch {
    return false;
  }
  return Number.isFinite(beat) && now - beat <= maxAgeMs;
}
