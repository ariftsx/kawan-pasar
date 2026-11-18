/** Thrown when the gate cannot take more work: answered as 429 with a short Retry-After. */
export class HashGateFull extends Error {
  constructor() {
    super('password hashing is at capacity');
    this.name = 'HashGateFull';
  }
}

export interface HashGateOptions {
  /** Argon2 jobs that may run at the same time (≈ CPU cores of the API). */
  concurrency: number;
  /** Jobs that may wait; beyond this a request is refused at once. */
  maxQueue: number;
  /** A waiting job gives up after this long. */
  maxWaitMs: number;
}

interface Waiter {
  start: () => void;
  timer: ReturnType<typeof setTimeout>;
}

/**
 * Bounds concurrent Argon2 work. Every sign-in costs one hash; without a bound, a flood of
 * attempts (one per address, so per-IP limits do not stop it) saturates the CPU and starves
 * every other request (database and session timeouts, Fase 2A load test). With the gate a flood
 * is refused cheaply and the rest of the API keeps answering.
 */
export class HashGate {
  private running = 0;
  private readonly waiting: Waiter[] = [];

  constructor(private readonly options: HashGateOptions) {}

  async run<T>(job: () => Promise<T>): Promise<T> {
    await this.acquire();
    try {
      return await job();
    } finally {
      this.release();
    }
  }

  private acquire(): Promise<void> {
    if (this.running < this.options.concurrency) {
      this.running += 1;
      return Promise.resolve();
    }
    if (this.waiting.length >= this.options.maxQueue) return Promise.reject(new HashGateFull());
    return new Promise((resolve, reject) => {
      const waiter: Waiter = {
        start: () => {
          clearTimeout(waiter.timer);
          resolve();
        },
        timer: setTimeout(() => {
          const i = this.waiting.indexOf(waiter);
          if (i !== -1) this.waiting.splice(i, 1);
          reject(new HashGateFull());
        }, this.options.maxWaitMs),
      };
      this.waiting.push(waiter);
    });
  }

  private release(): void {
    const next = this.waiting.shift();
    // The slot passes straight to the next waiter; `running` only drops when nobody waits.
    if (next === undefined) this.running -= 1;
    else next.start();
  }
}
