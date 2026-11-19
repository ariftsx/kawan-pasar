import { Queue } from 'bullmq';
import { Redis } from 'ioredis';

/** Queue shared by the API (producer: data changed) and the worker (evaluation, weekly job). */
export const ALERTS_QUEUE = 'alerts';

export type AlertsJobName = 'evaluate' | 'weekly';

/** Payload-free on purpose: the worker reads the current data, never data sent by a client. */
export type AlertsJob = Record<string, never>;

export const ALERTS_TRIGGER = Symbol('ALERTS_TRIGGER');

export interface AlertsTrigger {
  /** Asks the worker to evaluate every watch against the latest data. Best effort. */
  dataChanged(): Promise<void>;
}

export class BullAlertsTrigger implements AlertsTrigger {
  private readonly connection: Redis;
  private readonly queue: Queue<AlertsJob, unknown, AlertsJobName>;

  constructor(url: string) {
    this.connection = new Redis(url, { maxRetriesPerRequest: null });
    this.queue = new Queue(ALERTS_QUEUE, { connection: this.connection });
  }

  async dataChanged(): Promise<void> {
    // Collapsed: a burst of imports queues one evaluation; a change during a running evaluation
    // queues exactly one more (so data that arrived mid-run is still evaluated). Repeats would be
    // harmless anyway: notifications are idempotent per data date.
    await this.queue.add(
      'evaluate',
      {},
      {
        deduplication: { id: 'evaluate', keepLastIfActive: true },
        attempts: 3,
        backoff: { type: 'exponential', delay: 10_000 },
        removeOnComplete: { count: 100 },
        removeOnFail: { age: 24 * 3600 },
      },
    );
  }

  async close(): Promise<void> {
    await this.queue.close();
    this.connection.disconnect();
  }
}
