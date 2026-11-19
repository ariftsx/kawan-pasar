import { Queue, Worker } from 'bullmq';
import type { Job } from 'bullmq';
import { Redis } from 'ioredis';
import type { Db } from '../../database/client.js';
import type { AuthTokenService } from '../auth/auth-token.service.js';
import type { MailOutbox } from '../mail/mail.queue.js';
import { ALERTS_QUEUE } from './alerts.queue.js';
import type { AlertsJob, AlertsJobName } from './alerts.queue.js';
import { evaluateAlerts } from './evaluator.js';
import { WEEKLY_CRON, WEEKLY_TZ, sendWeeklySummaries } from './weekly.js';

export interface AlertsWorkerOptions {
  queueUrl: string;
  db: Db;
  tokens: AuthTokenService;
  outbox: MailOutbox;
  now: () => Date;
  /** One JSON line per event; counts only, never addresses or texts. */
  log: (line: string) => void;
}

export interface AlertsWorker {
  close(): Promise<void>;
}

/**
 * Consumes the alerts queue one job at a time (evaluations of the same data must not race) and
 * registers the weekly summary job scheduler (idempotent: every worker start upserts the same).
 */
export async function startAlertsWorker(options: AlertsWorkerOptions): Promise<AlertsWorker> {
  const connection = new Redis(options.queueUrl, { maxRetriesPerRequest: null });
  const queue = new Queue<AlertsJob, unknown, AlertsJobName>(ALERTS_QUEUE, { connection });
  await queue.upsertJobScheduler(
    'weekly',
    { pattern: WEEKLY_CRON, tz: WEEKLY_TZ },
    {
      name: 'weekly',
      data: {},
      opts: {
        // A partial failure (some e-mails not queued) throws: retried, and only those are resent.
        attempts: 3,
        backoff: { type: 'exponential', delay: 60_000 },
        removeOnComplete: { count: 20 },
        removeOnFail: { age: 7 * 24 * 3600 },
      },
    },
  );
  const event = (msg: string, fields: Record<string, string | number>): void => {
    options.log(
      JSON.stringify({
        level: 'info',
        time: new Date().toISOString(),
        service: 'worker',
        msg,
        ...fields,
      }),
    );
  };

  const worker = new Worker<AlertsJob, unknown, AlertsJobName>(
    ALERTS_QUEUE,
    async (job: Job<AlertsJob, unknown, AlertsJobName>) => {
      if (job.name === 'evaluate') {
        const r = await evaluateAlerts(options.db);
        event('alerts evaluated', { watches: r.watches, created: r.created });
        return r;
      }
      const r = await sendWeeklySummaries(
        { db: options.db, tokens: options.tokens, outbox: options.outbox },
        options.now(),
      );
      event('weekly summary', { users: r.users, sent: r.sent });
      return r;
    },
    { connection, concurrency: 1 },
  );
  worker.on('failed', (job, err) => {
    options.log(
      JSON.stringify({
        level: 'warn',
        time: new Date().toISOString(),
        service: 'worker',
        msg: 'alerts job failed',
        job: job?.name ?? 'unknown',
        error: err.name,
      }),
    );
  });

  return {
    async close(): Promise<void> {
      await worker.close();
      await queue.close();
      connection.disconnect();
    },
  };
}
