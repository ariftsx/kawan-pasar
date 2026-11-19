import { describe, expect, it } from 'vitest';
import {
  AlertsResponseSchema,
  MarkReadInputSchema,
  NotificationSchema,
  NotificationsQuerySchema,
  WatchInputSchema,
  WatchUpdateSchema,
} from './alerts.js';

describe('alert contracts', () => {
  it('a watch names a catalog commodity and optionally a whole-rupiah limit with a direction', () => {
    expect(WatchInputSchema.parse({ commodity: 'cabai-merah-keriting' })).toEqual({
      commodity: 'cabai-merah-keriting',
    });
    expect(
      WatchInputSchema.parse({
        commodity: 'bawang-merah',
        threshold: { thresholdIdr: 39_000, direction: 'above' },
      }).threshold,
    ).toEqual({ thresholdIdr: 39_000, direction: 'above' });
    for (const bad of [
      { commodity: 'gula' },
      { commodity: 'bawang-merah', threshold: { thresholdIdr: 0, direction: 'above' } },
      { commodity: 'bawang-merah', threshold: { thresholdIdr: 1.5, direction: 'above' } },
      { commodity: 'bawang-merah', threshold: { thresholdIdr: 39_000 } },
      { commodity: 'bawang-merah', extra: 1 },
    ]) {
      expect(WatchInputSchema.safeParse(bad).success, JSON.stringify(bad)).toBe(false);
    }
    expect(WatchUpdateSchema.parse({ threshold: null })).toEqual({ threshold: null });
  });

  it('notification links are product paths only, never full URLs', () => {
    const base = {
      id: 1,
      kind: 'price_threshold',
      title: 'Bawang merah di atas Rp 39.000/kg',
      body: 'x',
      dataDate: '2026-09-30',
      modelVersion: null,
      read: false,
      createdAt: '2026-11-19T00:00:00.000Z',
    };
    expect(NotificationSchema.safeParse({ ...base, link: '/harga/bawang-merah' }).success).toBe(
      true,
    );
    for (const link of ['https://evil.example/', '//evil.example', '/x"><script>']) {
      expect(NotificationSchema.safeParse({ ...base, link }).success, link).toBe(false);
    }
  });

  it('marking read takes ids or all, and the list query defaults to all', () => {
    expect(MarkReadInputSchema.safeParse({ ids: [1, 2] }).success).toBe(true);
    expect(MarkReadInputSchema.safeParse({ all: true }).success).toBe(true);
    expect(MarkReadInputSchema.safeParse({ ids: [] }).success).toBe(false);
    expect(MarkReadInputSchema.safeParse({}).success).toBe(false);
    expect(NotificationsQuerySchema.parse({})).toEqual({ tab: 'all' });
    expect(NotificationsQuerySchema.parse({ tab: 'unread', before: '12' })).toEqual({
      tab: 'unread',
      before: 12,
    });
  });

  it('caps the number of watches in a response', () => {
    const prefs = {
      inApp: true,
      weekly: false,
      unusualMove: true,
      forecastRise: true,
      priceThreshold: true,
    };
    expect(
      AlertsResponseSchema.safeParse({ preferences: prefs, watches: [], emailVerified: true })
        .success,
    ).toBe(true);
  });
});
