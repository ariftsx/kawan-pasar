import { Worker } from 'bullmq';
import type { Job } from 'bullmq';
import { Redis } from 'ioredis';
import { createTransport } from 'nodemailer';
import { MAIL_QUEUE } from './mail.queue.js';
import type { MailJob } from './mail.queue.js';
import { renderMail } from './templates.js';

export interface MailWorkerOptions {
  queueUrl: string;
  smtpUrl: string;
  from: string;
  siteUrl: string;
  /** One JSON line per event; never the address or the token. */
  log: (line: string) => void;
  /** Turns a job into the e-mail to send (e.g. resolves forgot_password); null = send nothing. */
  resolve?: (job: MailJob) => Promise<MailJob | null>;
}

export interface MailWorker {
  close(): Promise<void>;
}

/** Consumes the mail queue and delivers over SMTP. Failed jobs are retried by BullMQ. */
export function startMailWorker(options: MailWorkerOptions): MailWorker {
  const transport = createTransport({
    url: options.smtpUrl,
    connectionTimeout: 5_000,
    greetingTimeout: 5_000,
    socketTimeout: 10_000,
  });
  const connection = new Redis(options.queueUrl, { maxRetriesPerRequest: null });
  const event = (level: 'info' | 'warn', msg: string, fields: Record<string, string | number>) => {
    options.log(
      JSON.stringify({ level, time: new Date().toISOString(), service: 'worker', msg, ...fields }),
    );
  };

  const worker = new Worker<MailJob>(
    MAIL_QUEUE,
    async (job: Job<MailJob>) => {
      const data = options.resolve === undefined ? job.data : await options.resolve(job.data);
      if (data === null) return;
      const mail = renderMail(data, options.siteUrl);
      if (mail === null) return;
      if (data.to === undefined) throw new Error('mail job without recipient');
      await transport.sendMail({ from: options.from, to: data.to, ...mail });
    },
    { connection, concurrency: 4 },
  );
  worker.on('completed', (job) => {
    if (job.data.template !== 'noop') event('info', 'mail sent', { template: job.data.template });
  });
  worker.on('failed', (job, error) => {
    event('warn', 'mail failed', {
      template: job?.data.template ?? 'unknown',
      attempt: job?.attemptsMade ?? 0,
      // Error class only: SMTP error texts can echo the recipient address.
      reason: error.name,
    });
  });
  worker.on('error', (error) => {
    event('warn', 'mail worker error', { reason: error.name });
  });

  return {
    close: async () => {
      await worker.close();
      transport.close();
      connection.disconnect();
    },
  };
}
