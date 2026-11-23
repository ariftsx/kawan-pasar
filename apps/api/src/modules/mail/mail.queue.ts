import { Inject, Module } from '@nestjs/common';
import type { OnApplicationShutdown } from '@nestjs/common';
import { Queue } from 'bullmq';
import { Redis } from 'ioredis';
import { ENV } from '../../config/config.module.js';
import type { Env } from '../../config/env.js';

/** Queue name shared by the API (producer) and the worker (consumer). */
export const MAIL_QUEUE = 'mail';

export type MailTemplate =
  | 'verify_email'
  | 'already_registered'
  | 'reset_password'
  | 'password_changed'
  | 'account_deleted'
  /** Fase 2B: the weekly summary (facts only), with a one-click unsubscribe link. */
  | 'weekly_summary'
  /** Fase 3B: the decision on an Analyst request (`lines` = the admin's note, rejection only). */
  | 'analyst_approved'
  /** Fase 3B: an admin account signed in (`lines` = device, WIB time; never an address). */
  | 'admin_sign_in'
  | 'analyst_rejected'
  /** Resolved by the worker into reset_password (or nothing): see forgot.ts. */
  | 'forgot_password'
  /** Nothing is sent; queued so "unknown address" costs the same as a real e-mail. */
  | 'noop';

/**
 * A queued e-mail. Holds the address and, for links, the token: both live only until the job
 * completes (removeOnComplete) and are never logged.
 */
export interface MailJob {
  template: MailTemplate;
  to?: string;
  token?: string;
  /** Client address for the audit event of a resolved request (hashed there, never logged). */
  ip?: string;
  /** Weekly summary: one line per watched commodity (prices and changes, no personal data). */
  lines?: string[];
}

export const MAIL_OUTBOX = Symbol('MAIL_OUTBOX');

export interface MailOutbox {
  send(job: MailJob): Promise<void>;
}

/** Producer side of the mail queue (BullMQ on valkey-queue). */
export class BullMailOutbox implements MailOutbox {
  private readonly connection: Redis;
  private readonly queue: Queue<MailJob>;

  constructor(url: string) {
    this.connection = new Redis(url, { maxRetriesPerRequest: null });
    this.queue = new Queue<MailJob>(MAIL_QUEUE, { connection: this.connection });
  }

  async send(job: MailJob): Promise<void> {
    await this.queue.add(job.template, job, {
      attempts: 5,
      backoff: { type: 'exponential', delay: 5_000 },
      removeOnComplete: true,
      // Failed jobs stay a day for diagnosis, then go: they hold an address (privacy page).
      removeOnFail: { age: 24 * 3600 },
    });
  }

  async close(): Promise<void> {
    await this.queue.close();
    this.connection.disconnect();
  }
}

@Module({
  providers: [
    {
      provide: MAIL_OUTBOX,
      inject: [ENV],
      useFactory: (env: Env): MailOutbox => new BullMailOutbox(env.VALKEY_QUEUE_URL),
    },
  ],
  exports: [MAIL_OUTBOX],
})
export class MailQueueModule implements OnApplicationShutdown {
  constructor(@Inject(MAIL_OUTBOX) private readonly outbox: MailOutbox) {}

  async onApplicationShutdown(): Promise<void> {
    if (this.outbox instanceof BullMailOutbox) await this.outbox.close();
  }
}
