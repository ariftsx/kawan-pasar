import { Queue } from 'bullmq';
import { Redis } from 'ioredis';
import { ALERTS_QUEUE } from '../alerts/alerts.queue.js';
import { MAIL_QUEUE } from '../mail/mail.queue.js';
import { WHATSAPP_QUEUE } from '../whatsapp/whatsapp.queue.js';

export type QueueName = 'mail' | 'alerts' | 'whatsapp';

export interface QueueCounts {
  name: QueueName;
  waiting: number;
  active: number;
  delayed: number;
  failed: number;
}

const NAMES: readonly QueueName[] = [MAIL_QUEUE, ALERTS_QUEUE, WHATSAPP_QUEUE] as QueueName[];

/**
 * Job counts of the background queues for the admin monitoring page (Fase 3B). Only counts are
 * read: job data holds e-mail addresses and tokens and never leaves the queue.
 */
export class QueueStats {
  private readonly connection: Redis;
  private readonly queues: Queue[];

  constructor(url: string) {
    this.connection = new Redis(url, { maxRetriesPerRequest: null });
    this.queues = NAMES.map((name) => new Queue(name, { connection: this.connection }));
  }

  async counts(): Promise<QueueCounts[]> {
    return Promise.all(
      this.queues.map(async (q, i) => {
        const c = await q.getJobCounts('waiting', 'active', 'delayed', 'failed');
        return {
          name: NAMES[i] ?? 'mail',
          waiting: c['waiting'] ?? 0,
          active: c['active'] ?? 0,
          delayed: c['delayed'] ?? 0,
          failed: c['failed'] ?? 0,
        };
      }),
    );
  }

  async close(): Promise<void> {
    await Promise.all(this.queues.map((q) => q.close()));
    this.connection.disconnect();
  }
}
