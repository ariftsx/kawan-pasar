import { maskPhone } from '@kawan-pasar/contracts';
import { Worker } from 'bullmq';
import type { Job } from 'bullmq';
import { and, count, eq, gte, inArray, isNull, sql } from 'drizzle-orm';
import { Redis } from 'ioredis';
import { createTransport } from 'nodemailer';
import type { Db } from '../../database/client.js';
import { notifications, whatsappMessages } from '../../database/schema/index.js';
import type { PhoneCipher } from '../auth/phone-cipher.js';
import type { UsersRepository } from '../auth/users.repository.js';
import {
  alertsMessage,
  codeMessage,
  helpMessage,
  stoppedMessage,
  weeklyMessage,
} from './messages.js';
import { WHATSAPP_QUEUE } from './whatsapp.queue.js';
import type { WhatsAppJob } from './whatsapp.queue.js';
import { WhatsAppRepository } from './whatsapp.repository.js';

/** K2: at most this many alert/summary messages per account per WIB day (codes and replies apart). */
export const MESSAGES_PER_DAY = 5;

/** Delivery to a phone. The real WhatsApp Business adapter would implement the same. */
export interface WhatsAppSender {
  send(to: string, text: string): Promise<void>;
}

/**
 * Local mock (design Fase 2 § 4): every WhatsApp message becomes an e-mail in Mailpit, which
 * plays the phone. The full number is only in the local test mailbox, never in logs or queues.
 */
export function mailpitWhatsAppSender(smtpUrl: string, from: string): WhatsAppSender {
  const transport = createTransport({
    url: smtpUrl,
    connectionTimeout: 5_000,
    greetingTimeout: 5_000,
    socketTimeout: 10_000,
  });
  return {
    async send(to, text) {
      try {
        await transport.sendMail({
          from,
          to: `wa-${to.replace(/\D/g, '')}@wa-tiruan.invalid`,
          subject: `WA tiruan ke ${maskPhone(to)}`,
          text,
        });
      } catch {
        // SMTP errors can quote the recipient (the number); BullMQ keeps failure reasons for a
        // day, so only a generic message leaves this function (review 2C).
        throw new Error('whatsapp mock delivery failed');
      }
    },
  };
}

/** Start of the current WIB calendar day. */
export function startOfWibDay(now: Date): Date {
  const wib = new Date(now.getTime() + 7 * 3600 * 1000);
  return new Date(
    Date.UTC(wib.getUTCFullYear(), wib.getUTCMonth(), wib.getUTCDate()) - 7 * 3600 * 1000,
  );
}

export interface WhatsAppWorkerOptions {
  queueUrl: string;
  db: Db;
  users: UsersRepository;
  phones: PhoneCipher;
  sender: WhatsAppSender;
  siteUrl: string;
  now: () => Date;
  /** One JSON line per event: kinds and outcomes only, never numbers, codes or texts. */
  log: (line: string) => void;
}

type Outcome = 'sent' | 'no_number' | 'not_connected' | 'daily_cap' | 'nothing_new';

/** Sends one queued WhatsApp job (exported for tests). */
export async function deliver(
  job: WhatsAppJob,
  o: Omit<WhatsAppWorkerOptions, 'queueUrl' | 'log'>,
): Promise<Outcome> {
  const repo = new WhatsAppRepository(o.db);
  const user = await o.users.findById(job.userId);
  const phone = user?.phone ?? null;
  if (phone === null) return 'no_number';
  const hashes = o.phones.lookupHashes(phone);
  const channel = await repo.channel(job.userId);
  if (channel === null || !hashes.some((h) => h.equals(channel.phoneHmac))) return 'not_connected';
  const phoneHmac = channel.phoneHmac;

  if (job.kind === 'code') {
    if (channel.status !== 'pending') return 'not_connected';
    await o.sender.send(phone, codeMessage(job.code));
    return 'sent';
  }
  if (job.kind === 'reply') {
    await o.sender.send(
      phone,
      job.reply === 'stopped' ? stoppedMessage(o.siteUrl) : helpMessage(o.siteUrl),
    );
    await repo.record(job.userId, phoneHmac, 'reply');
    return 'sent';
  }

  if ((await repo.deliverable([job.userId])).length === 0) return 'not_connected';
  const ids = job.kind === 'alerts' ? job.notificationIds : [job.notificationId];
  const kind = job.kind;
  // One transaction per user (advisory lock): count today, claim the unsent news, record, send.
  // A failed send rolls everything back (retry delivers); parallel jobs cannot pass the cap.
  return o.db.transaction(async (tx) => {
    await tx.execute(
      sql`SELECT pg_advisory_xact_lock(hashtextextended(${`wasend:${job.userId}`}, 0))`,
    );
    const today = await tx
      .select({ n: count() })
      .from(whatsappMessages)
      .where(
        and(
          eq(whatsappMessages.userId, job.userId),
          inArray(whatsappMessages.kind, ['alerts', 'weekly']),
          gte(whatsappMessages.createdAt, startOfWibDay(o.now())),
        ),
      );
    if ((today[0]?.n ?? 0) >= MESSAGES_PER_DAY) return 'daily_cap' as const;
    const news = await tx
      .update(notifications)
      .set({ sentWhatsappAt: sql`now()` })
      .where(
        and(
          eq(notifications.userId, job.userId),
          inArray(notifications.id, ids),
          isNull(notifications.sentWhatsappAt),
        ),
      )
      .returning({
        id: notifications.id,
        title: notifications.title,
        body: notifications.body,
        link: notifications.link,
      });
    if (news.length === 0) return 'nothing_new' as const;
    news.sort((a, b) => a.id - b.id);
    const first = news[0];
    const text =
      kind === 'weekly' && first !== undefined
        ? weeklyMessage(first.title, first.body, o.siteUrl)
        : alertsMessage(news, o.siteUrl);
    await tx.insert(whatsappMessages).values({ userId: job.userId, phoneHmac, kind });
    await o.sender.send(phone, text);
    return 'sent' as const;
  });
}

export interface WhatsAppWorker {
  close(): Promise<void>;
}

export function startWhatsAppWorker(options: WhatsAppWorkerOptions): WhatsAppWorker {
  const connection = new Redis(options.queueUrl, { maxRetriesPerRequest: null });
  const worker = new Worker<WhatsAppJob>(
    WHATSAPP_QUEUE,
    async (job: Job<WhatsAppJob>) => {
      const outcome = await deliver(job.data, options);
      options.log(
        JSON.stringify({
          level: 'info',
          time: new Date().toISOString(),
          service: 'worker',
          msg: 'whatsapp',
          kind: job.data.kind,
          outcome,
        }),
      );
      return outcome;
    },
    { connection, concurrency: 2 },
  );
  worker.on('failed', (job, err) => {
    options.log(
      JSON.stringify({
        level: 'warn',
        time: new Date().toISOString(),
        service: 'worker',
        msg: 'whatsapp failed',
        kind: job?.data.kind ?? 'unknown',
        error: err.name,
      }),
    );
  });
  return {
    async close(): Promise<void> {
      await worker.close();
      connection.disconnect();
    },
  };
}
