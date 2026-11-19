import type {
  AlertPreferences,
  NotificationItem,
  NotificationTab,
  Watch,
} from '@kawan-pasar/contracts';
import { and, count, desc, eq, inArray, isNull, lt, sql } from 'drizzle-orm';
import type { SQL } from 'drizzle-orm';
import type { Db } from '../../database/client.js';
import {
  alertPreferences,
  alertWatches,
  commodities,
  markets,
  notifications,
} from '../../database/schema/index.js';

/** Switches until the user saves their own (same as the column defaults). */
export const DEFAULT_PREFERENCES: AlertPreferences = {
  inApp: true,
  weekly: false,
  unusualMove: true,
  forecastRise: true,
  priceThreshold: true,
  whatsapp: true,
};

export const PAGE_SIZE = 20;
const UNIQUE_VIOLATION = '23505';

export type WatchThreshold = Watch['threshold'];

/**
 * Every query is scoped by the signed-in user's id (`WHERE user_id = …`): a watch or a
 * notification of someone else is "not found", never readable or changeable (no IDOR).
 */
export class AlertsRepository {
  constructor(private readonly db: Db) {}

  async preferences(userId: string): Promise<AlertPreferences> {
    const rows = await this.db
      .select({
        inApp: alertPreferences.inApp,
        weekly: alertPreferences.weekly,
        unusualMove: alertPreferences.unusualMove,
        forecastRise: alertPreferences.forecastRise,
        priceThreshold: alertPreferences.priceThreshold,
        whatsapp: alertPreferences.whatsapp,
      })
      .from(alertPreferences)
      .where(eq(alertPreferences.userId, userId))
      .limit(1);
    return rows[0] ?? DEFAULT_PREFERENCES;
  }

  async savePreferences(userId: string, p: AlertPreferences): Promise<void> {
    await this.db
      .insert(alertPreferences)
      .values({ userId, ...p })
      .onConflictDoUpdate({
        target: alertPreferences.userId,
        set: { ...p, updatedAt: sql`now()` },
      });
  }

  async setWeekly(userId: string, weekly: boolean): Promise<void> {
    await this.savePreferences(userId, { ...(await this.preferences(userId)), weekly });
  }

  async watches(userId: string): Promise<Watch[]> {
    const rows = await this.db
      .select({
        id: alertWatches.id,
        code: commodities.code,
        name: commodities.name,
        thresholdIdr: alertWatches.thresholdIdr,
        direction: alertWatches.direction,
      })
      .from(alertWatches)
      .innerJoin(commodities, eq(commodities.id, alertWatches.commodityId))
      .where(eq(alertWatches.userId, userId))
      .orderBy(alertWatches.id);
    return rows.map((r) => ({
      id: r.id,
      commodity: { code: r.code as Watch['commodity']['code'], name: r.name },
      threshold:
        r.thresholdIdr === null || r.direction === null
          ? null
          : { thresholdIdr: r.thresholdIdr, direction: r.direction },
    }));
  }

  /**
   * Adds a watch unless the user already has `max`. Count and insert run in one transaction
   * holding a per-user advisory lock, so parallel requests cannot pass the limit together.
   */
  async addWatch(
    userId: string,
    marketCode: string,
    commodityCode: string,
    threshold: WatchThreshold,
    max: number,
  ): Promise<'added' | 'duplicate' | 'limit'> {
    const ids = await this.db
      .select({ marketId: markets.id, commodityId: commodities.id })
      .from(markets)
      .innerJoin(commodities, eq(commodities.code, commodityCode))
      .where(eq(markets.code, marketCode))
      .limit(1);
    const target = ids[0];
    if (target === undefined) return 'duplicate';
    try {
      return await this.db.transaction(async (tx) => {
        await tx.execute(
          sql`SELECT pg_advisory_xact_lock(hashtextextended(${`watch:${userId}`}, 0))`,
        );
        const counted = await tx
          .select({ n: count() })
          .from(alertWatches)
          .where(eq(alertWatches.userId, userId));
        if ((counted[0]?.n ?? 0) >= max) return 'limit' as const;
        await tx.insert(alertWatches).values({
          userId,
          ...target,
          thresholdIdr: threshold?.thresholdIdr ?? null,
          direction: threshold?.direction ?? null,
        });
        return 'added' as const;
      });
    } catch (e) {
      if (pgCode(e) === UNIQUE_VIOLATION) return 'duplicate';
      throw e;
    }
  }

  async updateWatch(userId: string, id: number, threshold: WatchThreshold): Promise<boolean> {
    const rows = await this.db
      .update(alertWatches)
      .set({
        thresholdIdr: threshold?.thresholdIdr ?? null,
        direction: threshold?.direction ?? null,
      })
      .where(and(eq(alertWatches.id, id), eq(alertWatches.userId, userId)))
      .returning({ id: alertWatches.id });
    return rows.length === 1;
  }

  async removeWatch(userId: string, id: number): Promise<boolean> {
    const rows = await this.db
      .delete(alertWatches)
      .where(and(eq(alertWatches.id, id), eq(alertWatches.userId, userId)))
      .returning({ id: alertWatches.id });
    return rows.length === 1;
  }

  async notifications(
    userId: string,
    tab: NotificationTab,
    before: number | undefined,
  ): Promise<{ items: NotificationItem[]; next: number | null }> {
    const where: SQL[] = [eq(notifications.userId, userId)];
    if (tab === 'unread') where.push(isNull(notifications.readAt));
    if (tab === 'weekly') where.push(eq(notifications.kind, 'weekly'));
    if (before !== undefined) where.push(lt(notifications.id, before));
    const rows = await this.db
      .select()
      .from(notifications)
      .where(and(...where))
      // Ids grow with time: keyset pagination on (id) is stable and index-backed.
      .orderBy(desc(notifications.id))
      .limit(PAGE_SIZE + 1);
    const page = rows.slice(0, PAGE_SIZE);
    return {
      items: page.map((n) => ({
        id: n.id,
        kind: n.kind,
        title: n.title,
        body: n.body,
        link: n.link,
        dataDate: n.dataDate,
        modelVersion: n.modelVersion,
        read: n.readAt !== null,
        sentWhatsapp: n.sentWhatsappAt !== null,
        createdAt: n.createdAt.toISOString(),
      })),
      next: rows.length > PAGE_SIZE ? (page.at(-1)?.id ?? null) : null,
    };
  }

  async unreadCount(userId: string): Promise<number> {
    const rows = await this.db
      .select({ n: count() })
      .from(notifications)
      .where(and(eq(notifications.userId, userId), isNull(notifications.readAt)));
    return rows[0]?.n ?? 0;
  }

  /** Marks the given ids (only the user's own) or all as read; returns how many changed. */
  async markRead(userId: string, ids: number[] | 'all'): Promise<number> {
    const where = [eq(notifications.userId, userId), isNull(notifications.readAt)];
    if (ids !== 'all') where.push(inArray(notifications.id, ids));
    const rows = await this.db
      .update(notifications)
      .set({ readAt: sql`now()` })
      .where(and(...where))
      .returning({ id: notifications.id });
    return rows.length;
  }
}

/** SQLSTATE of a pg error, also when Drizzle wraps it (DrizzleQueryError.cause). */
function pgCode(e: unknown): string | undefined {
  if (typeof e !== 'object' || e === null) return undefined;
  const own: unknown = Reflect.get(e, 'code');
  if (typeof own === 'string') return own;
  const cause: unknown = Reflect.get(e, 'cause');
  return cause === undefined ? undefined : pgCode(cause);
}
