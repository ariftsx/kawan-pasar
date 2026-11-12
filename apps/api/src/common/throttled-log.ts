/**
 * Emits a warning at most once per key and interval. During a dependency outage (e.g. Valkey
 * down) every request would otherwise log the same line and flood the logs exactly when they
 * are needed most. Suppressed repeats are counted and reported with the next emitted warning.
 */
export class ThrottledWarning {
  private readonly last = new Map<string, { at: number; suppressed: number }>();

  constructor(
    private readonly intervalMs: number,
    private readonly emit: (message: string) => void,
    private readonly now: () => number = Date.now,
  ) {}

  warn(key: string, message: string): void {
    const t = this.now();
    const entry = this.last.get(key);
    if (entry !== undefined && t - entry.at < this.intervalMs) {
      entry.suppressed += 1;
      return;
    }
    const suffix =
      entry !== undefined && entry.suppressed > 0
        ? ` (${String(entry.suppressed)} similar warnings suppressed)`
        : '';
    this.last.set(key, { at: t, suppressed: 0 });
    this.emit(message + suffix);
  }
}
