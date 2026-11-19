import { z } from 'zod';
import { CommodityCodeSchema, IsoDateTime } from './common.js';

// Alerts and in-app news (Fase 2B; prototype d_peringatan / m_peringatan). Validated in the BFF
// Server Actions and again in the API.

export const AlertPreferencesSchema = z.strictObject({
  /** News in the app (the "Peringatan" page). */
  inApp: z.boolean(),
  /** Weekly summary, Monday 06.00 WIB, in the app and by e-mail. */
  weekly: z.boolean(),
  /** Rule: the 7-day change is beyond the commodity's usual range (90th percentile). */
  unusualMove: z.boolean(),
  /** Rule: the ARIF-Net median for 7 or 30 days ahead is above +2 % (never from demo data). */
  forecastRise: z.boolean(),
  /** Rule: the price crosses the user's own limit. */
  priceThreshold: z.boolean(),
  /** WhatsApp (Fase 2C): news and the weekly summary, once the channel is verified. */
  whatsapp: z.boolean(),
});
export type AlertPreferences = z.infer<typeof AlertPreferencesSchema>;

export const AlertDirectionSchema = z.enum(['above', 'below']);
export type AlertDirection = z.infer<typeof AlertDirectionSchema>;

/** A rupiah limit per kg: whole rupiah, 1 to 10 000 000. */
export const ThresholdSchema = z.int().min(1).max(10_000_000);

const Threshold = z.strictObject({
  thresholdIdr: ThresholdSchema,
  direction: AlertDirectionSchema,
});

export const WatchInputSchema = z.strictObject({
  commodity: CommodityCodeSchema,
  /** Optional own limit; both fields or neither. */
  threshold: Threshold.nullable().optional(),
});
export type WatchInput = z.infer<typeof WatchInputSchema>;

export const WatchUpdateSchema = z.strictObject({ threshold: Threshold.nullable() });
export type WatchUpdate = z.infer<typeof WatchUpdateSchema>;

export const WatchIdSchema = z.coerce.number().int().min(1).max(Number.MAX_SAFE_INTEGER);

export const WatchSchema = z.strictObject({
  id: z.number().int().positive(),
  commodity: z.strictObject({ code: CommodityCodeSchema, name: z.string() }),
  threshold: Threshold.nullable(),
});
export type Watch = z.infer<typeof WatchSchema>;

export const AlertsResponseSchema = z.strictObject({
  preferences: AlertPreferencesSchema,
  watches: z.array(WatchSchema).max(20),
  /** News is only sent to verified accounts; settings can be prepared before. */
  emailVerified: z.boolean(),
});
export type AlertsResponse = z.infer<typeof AlertsResponseSchema>;

export const MAX_WATCHES = 20;

export const NotificationKindSchema = z.enum([
  'unusual_move',
  'forecast_rise',
  'price_threshold',
  'weekly',
]);
export type NotificationKind = z.infer<typeof NotificationKindSchema>;

export const NotificationTabSchema = z.enum(['all', 'unread', 'weekly']);
export type NotificationTab = z.infer<typeof NotificationTabSchema>;

export const NotificationSchema = z.strictObject({
  id: z.number().int().positive(),
  kind: NotificationKindSchema,
  title: z.string().max(160),
  body: z.string().max(1200),
  /** Relative product path (never "//host" or a full URL), or null. */
  link: z
    .string()
    // The first character after '/' is a letter or digit: '//host' would leave the site.
    .regex(/^\/[a-z0-9][a-z0-9/?=&._-]*$/)
    .nullable(),
  /** The date the numbers are from (YYYY-MM-DD). */
  dataDate: z.iso.date(),
  modelVersion: z.string().max(64).nullable(),
  read: z.boolean(),
  /** Also delivered by WhatsApp (Fase 2C). */
  sentWhatsapp: z.boolean(),
  createdAt: IsoDateTime,
});
export type NotificationItem = z.infer<typeof NotificationSchema>;

export const NotificationsQuerySchema = z.strictObject({
  tab: NotificationTabSchema.default('all'),
  /** Keyset cursor: the id of the last item of the previous page. */
  before: WatchIdSchema.optional(),
});

export const NotificationsResponseSchema = z.strictObject({
  items: z.array(NotificationSchema).max(50),
  unread: z.number().int().min(0),
  /** Pass as `before` for the next page; null when there is none. */
  next: z.number().int().positive().nullable(),
});
export type NotificationsResponse = z.infer<typeof NotificationsResponseSchema>;

export const MarkReadInputSchema = z.union([
  z.strictObject({ ids: z.array(z.number().int().positive()).min(1).max(50) }),
  z.strictObject({ all: z.literal(true) }),
]);
export type MarkReadInput = z.infer<typeof MarkReadInputSchema>;

export const UnreadCountResponseSchema = z.strictObject({ unread: z.number().int().min(0) });
