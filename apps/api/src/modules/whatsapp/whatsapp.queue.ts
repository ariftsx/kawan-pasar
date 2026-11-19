import { Queue } from 'bullmq';
import { Redis } from 'ioredis';

/** Queue shared by the API and the alerts worker (producers) and the WhatsApp consumer. */
export const WHATSAPP_QUEUE = 'whatsapp';

/**
 * Jobs hold user ids and notification ids, never the phone number: the worker opens the number
 * from the database just before sending. A verification code is in its job until sent (as e-mail
 * tokens are in mail jobs), and the job is removed on completion.
 */
export type WhatsAppJob =
  | { kind: 'code'; userId: string; code: string }
  | { kind: 'alerts'; userId: string; notificationIds: number[] }
  | { kind: 'weekly'; userId: string; notificationId: number }
  | { kind: 'reply'; userId: string; reply: 'stopped' | 'help' };

export const WHATSAPP_OUTBOX = Symbol('WHATSAPP_OUTBOX');

export interface WhatsAppOutbox {
  send(job: WhatsAppJob): Promise<void>;
}

export class BullWhatsAppOutbox implements WhatsAppOutbox {
  private readonly connection: Redis;
  private readonly queue: Queue<WhatsAppJob>;

  constructor(url: string) {
    this.connection = new Redis(url, { maxRetriesPerRequest: null });
    this.queue = new Queue<WhatsAppJob>(WHATSAPP_QUEUE, { connection: this.connection });
  }

  async send(job: WhatsAppJob): Promise<void> {
    await this.queue.add(job.kind, job, {
      attempts: 5,
      backoff: { type: 'exponential', delay: 5_000 },
      removeOnComplete: true,
      // Failed jobs stay a day for diagnosis (a code inside expires after 10 minutes anyway).
      removeOnFail: { age: 24 * 3600 },
    });
  }

  async close(): Promise<void> {
    await this.queue.close();
    this.connection.disconnect();
  }
}
