// Outlook response from apps/api /v1/outlook/:slug (docs 08 §3), parsed at the edge of the web
// app. A forecast without full provenance is never shown (CONTRIBUTING rule 5).
import { Availability, HORIZON_DAYS } from '@kawan-pasar/contracts';
import { z } from 'zod';

export const OutlookStatus = z.enum([
  'available',
  'candidate',
  'stale',
  'in_development',
  'missing',
]);

const Point = z.object({
  horizon_day: z.number().int(),
  target_date: z.string(),
  predicted_change: z.number(),
  predicted_price_idr: z.number().int(),
});

export const OutlookBody = z.object({
  data: z.object({
    status: OutlookStatus,
    forecast: z.object({
      run: z.object({ origin: z.string(), market: z.string() }),
      reference_price_idr: z.number().int(),
      points: z.array(Point),
    }),
  }),
  provenance: z.object({
    model_version: z.string().min(1),
    dataset_version: z.string().min(1),
    preprocessing_version: z.string().min(1),
    data_cutoff: z.string().min(1),
    artifact_status: z.string().min(1),
  }),
  limitations: z.array(z.string()),
  availability: z
    .object({
      price: Availability,
      climate: Availability,
      news: Availability,
      macro_logistics: Availability,
      calendar: Availability,
    })
    .optional(),
});

export type ContextAvailability = NonNullable<z.infer<typeof OutlookBody>['availability']>;

export type OutlookPoint = z.infer<typeof Point>;
export type OutlookStatus = z.infer<typeof OutlookStatus>;
export type Provenance = z.infer<typeof OutlookBody>['provenance'];

export type Outlook =
  | {
      readonly kind: 'ready';
      readonly status: OutlookStatus;
      readonly isDemo: boolean;
      readonly origin: string;
      readonly referencePrice: number;
      readonly points: readonly OutlookPoint[];
      readonly provenance: Provenance;
      readonly limitations: readonly string[];
      readonly availability: ContextAvailability;
    }
  | { readonly kind: 'unavailable'; readonly requestId: string | null };

export function parseOutlook(body: unknown, requestId: string | null): Outlook {
  const parsed = OutlookBody.safeParse(body);
  if (!parsed.success || parsed.data.data.status === 'missing') {
    return { kind: 'unavailable', requestId };
  }
  const { data, provenance, limitations, availability } = parsed.data;
  return {
    kind: 'ready',
    status: data.status,
    isDemo: data.status === 'in_development',
    origin: data.forecast.run.origin,
    referencePrice: data.forecast.reference_price_idr,
    points: data.forecast.points,
    provenance,
    limitations,
    availability: availability ?? {
      price: 'missing',
      climate: 'missing',
      news: 'missing',
      macro_logistics: 'missing',
      calendar: 'missing',
    },
  };
}

export type HorizonDay = (typeof HORIZON_DAYS)[number];
export { HORIZON_DAYS };

/**
 * Horizon status in the product (keterbatasan): up to 30 days is evaluated walk-forward, 90 days
 * only partly, and 180/365 days cannot be tested prospectively yet, so their values stay hidden.
 */
export type HorizonStatus = 'tersedia' | 'sebagian' | 'belum-diuji';

export function horizonStatus(day: number): HorizonStatus {
  if (day <= 30) return 'tersedia';
  if (day <= 90) return 'sebagian';
  return 'belum-diuji';
}

export function horizonLabel(day: number): string {
  return day === 365 ? '1 tahun' : `${String(day)} hari`;
}

export function horizonShort(day: number): string {
  return day === 365 ? '1T' : `${String(day)}H`;
}

export function parseHorizon(value: string | undefined, fallback: HorizonDay = 7): HorizonDay {
  const day = Number(value);
  return (HORIZON_DAYS as readonly number[]).includes(day) ? (day as HorizonDay) : fallback;
}

/** The point to show for a horizon, or `null` when it is missing or not yet tested. */
export function visiblePoint(points: readonly OutlookPoint[], day: number): OutlookPoint | null {
  if (horizonStatus(day) === 'belum-diuji') return null;
  return points.find((point) => point.horizon_day === day) ?? null;
}
