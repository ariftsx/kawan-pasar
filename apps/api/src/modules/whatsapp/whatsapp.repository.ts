import { and, count, eq, gt, gte, inArray, isNotNull, lt, sql } from 'drizzle-orm';
import type { Db } from '../../database/client.js';
import { whatsappChannels, whatsappMessages } from '../../database/schema/index.js';

export type ChannelStatus = 'pending' | 'verified' | 'stopped';
export type MessageKind = 'code' | 'alerts' | 'weekly' | 'reply';

export interface Channel {
  userId: string;
  status: ChannelStatus;
  phoneHmac: Buffer;
  codeHash: Buffer | null;
  codeExpiresAt: Date | null;
  codeAttempts: number;
}

const columns = {
  userId: whatsappChannels.userId,
  status: whatsappChannels.status,
  phoneHmac: whatsappChannels.phoneHmac,
  codeHash: whatsappChannels.codeHash,
  codeExpiresAt: whatsappChannels.codeExpiresAt,
  codeAttempts: whatsappChannels.codeAttempts,
};

/** Channel rows and the send log. Every query is scoped by user id or by the number's HMAC. */
export class WhatsAppRepository {
  constructor(private readonly db: Db) {}

  async channel(userId: string): Promise<Channel | null> {
    const rows = await this.db
      .select(columns)
      .from(whatsappChannels)
      .where(eq(whatsappChannels.userId, userId))
      .limit(1);
    return rows[0] ?? null;
  }

  /** Channels of a number (inbound messages), under every phone key held. */
  async channelsByPhone(hashes: readonly Buffer[]): Promise<Channel[]> {
    if (hashes.length === 0) return [];
    return this.db
      .select(columns)
      .from(whatsappChannels)
      .where(inArray(whatsappChannels.phoneHmac, [...hashes]));
  }

  /**
   * Starts a verification within the send limits, in one transaction holding a lock per account
   * and per number: parallel requests cannot both pass the checks (review 2C, Important 2).
   * Returns null when started, else the seconds to wait.
   */
  async startVerificationWithinLimits(input: {
    userId: string;
    phoneHmac: Buffer;
    /** The number under every key held (rows recorded before a key rotation count too). */
    phoneHashes: readonly Buffer[];
    codeHash: Buffer;
    expiresAt: Date;
    now: Date;
    perUserHour: number;
    perNumberDay: number;
  }): Promise<number | null> {
    return this.db.transaction(async (tx) => {
      await tx.execute(
        sql`SELECT pg_advisory_xact_lock(hashtextextended(${`wacode:${input.userId}`}, 0))`,
      );
      await tx.execute(
        sql`SELECT pg_advisory_xact_lock(hashtextextended(${`wanum:${input.phoneHmac.toString('hex')}`}, 0))`,
      );
      const hourAgo = new Date(input.now.getTime() - 3600 * 1000);
      const dayAgo = new Date(input.now.getTime() - 24 * 3600 * 1000);
      const byUser = await tx
        .select({ n: count() })
        .from(whatsappMessages)
        .where(
          and(
            eq(whatsappMessages.userId, input.userId),
            eq(whatsappMessages.kind, 'code'),
            gte(whatsappMessages.createdAt, hourAgo),
          ),
        );
      if ((byUser[0]?.n ?? 0) >= input.perUserHour) return 3600;
      const byNumber = await tx
        .select({ n: count() })
        .from(whatsappMessages)
        .where(
          and(
            inArray(whatsappMessages.phoneHmac, [...input.phoneHashes]),
            eq(whatsappMessages.kind, 'code'),
            gte(whatsappMessages.createdAt, dayAgo),
          ),
        );
      if ((byNumber[0]?.n ?? 0) >= input.perNumberDay) return 24 * 3600;
      const values = {
        status: 'pending' as const,
        phoneHmac: input.phoneHmac,
        codeHash: input.codeHash,
        codeExpiresAt: input.expiresAt,
        codeAttempts: 0,
        verifiedAt: null,
        stoppedAt: null,
        updatedAt: sql`now()`,
      };
      await tx
        .insert(whatsappChannels)
        .values({ userId: input.userId, ...values })
        .onConflictDoUpdate({ target: whatsappChannels.userId, set: values });
      // Counted when started, so retries of a failing send cannot exceed the limits.
      await tx
        .insert(whatsappMessages)
        .values({ userId: input.userId, phoneHmac: input.phoneHmac, kind: 'code' });
      return null;
    });
  }

  /**
   * Uses up one attempt of the live code BEFORE it is compared (review 2C, Important 1): parallel
   * guesses each take their own attempt, and the sixth gets nothing. Returns the code's hash and
   * the attempts now used, or null when no usable code is left (none, expired or spent).
   */
  async reserveAttempt(
    userId: string,
    now: Date,
  ): Promise<{ codeHash: Buffer; attempts: number } | null> {
    const rows = await this.db
      .update(whatsappChannels)
      .set({ codeAttempts: sql`${whatsappChannels.codeAttempts} + 1`, updatedAt: sql`now()` })
      .where(
        and(
          eq(whatsappChannels.userId, userId),
          eq(whatsappChannels.status, 'pending'),
          isNotNull(whatsappChannels.codeHash),
          lt(whatsappChannels.codeAttempts, 5),
          gt(whatsappChannels.codeExpiresAt, now),
        ),
      )
      .returning({ codeHash: whatsappChannels.codeHash, attempts: whatsappChannels.codeAttempts });
    const row = rows[0];
    return row === undefined || row.codeHash === null
      ? null
      : { codeHash: row.codeHash, attempts: row.attempts };
  }

  /** Verified only if the code row is still the one checked (no double use under a race). */
  async markVerified(userId: string, codeHash: Buffer): Promise<boolean> {
    const rows = await this.db
      .update(whatsappChannels)
      .set({
        status: 'verified',
        codeHash: null,
        codeExpiresAt: null,
        codeAttempts: 0,
        verifiedAt: sql`now()`,
        updatedAt: sql`now()`,
      })
      .where(and(eq(whatsappChannels.userId, userId), eq(whatsappChannels.codeHash, codeHash)))
      .returning({ userId: whatsappChannels.userId });
    return rows.length === 1;
  }

  async stop(userIds: readonly string[]): Promise<void> {
    if (userIds.length === 0) return;
    await this.db
      .update(whatsappChannels)
      .set({
        status: 'stopped',
        codeHash: null,
        codeExpiresAt: null,
        stoppedAt: sql`now()`,
        updatedAt: sql`now()`,
      })
      .where(inArray(whatsappChannels.userId, [...userIds]));
  }

  async remove(userId: string): Promise<void> {
    await this.db.delete(whatsappChannels).where(eq(whatsappChannels.userId, userId));
  }

  /** Of these users, the ones whose channel is verified and whose WhatsApp switch is on. */
  async deliverable(userIds: readonly string[]): Promise<string[]> {
    if (userIds.length === 0) return [];
    const rows = await this.db.execute(sql`
      SELECT c.user_id::text AS user_id
      FROM whatsapp_channels c
      LEFT JOIN alert_preferences p ON p.user_id = c.user_id
      WHERE c.status = 'verified' AND coalesce(p.whatsapp, true)
        AND c.user_id IN (${sql.join(
          userIds.map((id) => sql`${id}::uuid`),
          sql`, `,
        )})`);
    return (rows.rows as { user_id: string }[]).map((r) => r.user_id);
  }

  /**
   * Alert news written since `since` and not yet sent to WhatsApp, per user, for verified channels
   * with the WhatsApp switch on. Re-queued after every evaluation: a failed enqueue is caught up
   * by the next one, and sending claims each item once (no duplicates).
   */
  async pendingNews(since: Date): Promise<Map<string, number[]>> {
    const rows = await this.db.execute(sql`
      SELECT n.user_id::text AS user_id, array_agg(n.id ORDER BY n.id) AS ids
      FROM notifications n
      JOIN whatsapp_channels c ON c.user_id = n.user_id AND c.status = 'verified'
      LEFT JOIN alert_preferences p ON p.user_id = n.user_id
      WHERE n.sent_whatsapp_at IS NULL AND n.kind <> 'weekly' AND n.created_at >= ${since}
        AND coalesce(p.whatsapp, true)
      GROUP BY n.user_id`);
    const out = new Map<string, number[]>();
    for (const r of rows.rows as { user_id: string; ids: (string | number)[] }[]) {
      out.set(r.user_id, r.ids.map(Number));
    }
    return out;
  }

  async record(userId: string | null, phoneHmac: Buffer, kind: MessageKind): Promise<void> {
    await this.db.insert(whatsappMessages).values({ userId, phoneHmac, kind });
  }

  async countByUser(userId: string, kinds: readonly MessageKind[], since: Date): Promise<number> {
    const rows = await this.db
      .select({ n: count() })
      .from(whatsappMessages)
      .where(
        and(
          eq(whatsappMessages.userId, userId),
          inArray(whatsappMessages.kind, [...kinds]),
          gte(whatsappMessages.createdAt, since),
        ),
      );
    return rows[0]?.n ?? 0;
  }

  async countByPhone(
    phoneHashes: readonly Buffer[],
    kind: MessageKind,
    since: Date,
  ): Promise<number> {
    const rows = await this.db
      .select({ n: count() })
      .from(whatsappMessages)
      .where(
        and(
          inArray(whatsappMessages.phoneHmac, [...phoneHashes]),
          eq(whatsappMessages.kind, kind),
          gte(whatsappMessages.createdAt, since),
        ),
      );
    return rows[0]?.n ?? 0;
  }
}
