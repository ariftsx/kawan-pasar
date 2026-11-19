import { eq, sql } from 'drizzle-orm';
import { z } from 'zod';
import type { Db } from '../../database/client.js';
import { notifications } from '../../database/schema/index.js';
import type { AuthTokenService } from '../auth/auth-token.service.js';
import type { MailOutbox } from '../mail/mail.queue.js';
import type { Pair } from './evaluator.js';
import { isoDay, key, loadPairs } from './evaluator.js';
import { sevenDayChange, shortDate } from './rules.js';

/**
 * Weekly summary (Monday 06.00 WIB, BullMQ job scheduler in the worker): for every verified
 * account that switched it on and watches something, one in-app notification (kind "weekly",
 * idempotent per week) and one e-mail with a single-use unsubscribe link. Facts only.
 */

export const WEEKLY_CRON = '0 6 * * 1';
export const WEEKLY_TZ = 'Asia/Jakarta';
const MAX_LINES = 10;

const Recipient = z.object({
  user_id: z.string(),
  email: z.string(),
  market_id: z.number(),
  commodity_id: z.number(),
});

/** Monday (YYYY-MM-DD) of the WIB week that contains `now`. */
export function weekStart(now: Date): string {
  const wib = new Date(now.getTime() + 7 * 3600 * 1000);
  const back = (wib.getUTCDay() + 6) % 7;
  wib.setUTCDate(wib.getUTCDate() - back);
  return wib.toISOString().slice(0, 10);
}

const rupiah = (v: number): string => `Rp ${Math.round(v).toLocaleString('id-ID')}`;
const pct = (v: number): string =>
  `${(Math.abs(v) * 100).toLocaleString('id-ID', { minimumFractionDigits: 1, maximumFractionDigits: 1 })}%`;
const moved = (c: number): string =>
  Math.abs(c) < 0.0005 ? 'tetap' : `${c > 0 ? 'naik' : 'turun'} ${pct(c)}`;

/** One fact line per commodity; null when it has no price yet. */
export function summaryLine(p: Pair): string | null {
  const last = p.points.at(-1);
  if (last === undefined) return null;
  const change = sevenDayChange(p.points);
  const week = change === null ? '' : `, ${moved(change)} dalam 7 hari`;
  const h7 = p.forecasts.find((f) => f.horizonDays === 7);
  const forecast =
    h7 === undefined || h7.q50Change === null
      ? ''
      : ` Prediksi 7 hari: ${moved(h7.q50Change)} (estimasi).`;
  return `${p.name}: ${rupiah(last.price)}/kg${week} (data ${shortDate(isoDay(last.day))}).${forecast}`;
}

export interface WeeklyDeps {
  db: Db;
  tokens: AuthTokenService;
  outbox: MailOutbox;
}

export async function sendWeeklySummaries(
  deps: WeeklyDeps,
  now: Date,
): Promise<{ users: number; sent: number }> {
  const week = weekStart(now);
  const pairs = await loadPairs(deps.db);
  const rows = await deps.db.execute(sql`
    SELECT u.id AS user_id, u.email::text AS email, w.market_id, w.commodity_id
    FROM alert_preferences p
    JOIN users u ON u.id = p.user_id AND u.email_verified_at IS NOT NULL
    JOIN alert_watches w ON w.user_id = p.user_id
    WHERE p.weekly
    ORDER BY u.id, w.id`);
  const byUser = new Map<string, { email: string; lines: string[] }>();
  for (const r of z.array(Recipient).parse(rows.rows)) {
    const pair = pairs.get(key(r.market_id, r.commodity_id));
    const line = pair === undefined ? null : summaryLine(pair);
    const entry = byUser.get(r.user_id) ?? { email: r.email, lines: [] };
    if (line !== null) entry.lines.push(line);
    byUser.set(r.user_id, entry);
  }

  let sent = 0;
  let failed = 0;
  for (const [userId, { email, lines }] of byUser) {
    if (lines.length === 0) continue;
    const shown = lines.slice(0, MAX_LINES);
    if (lines.length > MAX_LINES)
      shown.push(`dan ${String(lines.length - MAX_LINES)} komoditas lain.`);
    const inserted = await deps.db
      .insert(notifications)
      .values({
        userId,
        kind: 'weekly',
        dataDate: week,
        title: `Ringkasan mingguan · ${shortDate(week)}`,
        body: shown.join('\n'),
        link: '/peringatan',
      })
      .onConflictDoNothing()
      .returning({ id: notifications.id });
    // Already sent this week (job retried or run twice): no second e-mail either.
    const id = inserted[0]?.id;
    if (id === undefined) continue;
    try {
      const token = await deps.tokens.issue(userId, 'weekly_unsubscribe');
      await deps.outbox.send({ template: 'weekly_summary', to: email, token, lines: shown });
      sent += 1;
    } catch {
      // The week's row is the "sent" marker: drop it so a retry sends this user's summary,
      // and carry on with the others.
      await deps.db.delete(notifications).where(eq(notifications.id, id));
      failed += 1;
    }
  }
  // Fail the job (BullMQ retries it with backoff) only after everyone else was served.
  if (failed > 0) throw new WeeklyPartialFailure(failed, sent);
  return { users: byUser.size, sent };
}

export class WeeklyPartialFailure extends Error {
  constructor(
    readonly failed: number,
    readonly sent: number,
  ) {
    super(`weekly summary: ${String(failed)} not sent, ${String(sent)} sent`);
    this.name = 'WeeklyPartialFailure';
  }
}
