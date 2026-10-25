'use client';

// 7-day outlook for the model commodities, fetched through the BFF (never the API directly,
// docs 14 §4). A failure only hides the forecast; today's cost still renders (docs 04 §7).
import { modelCommodities } from '@kawan-pasar/catalog';
import { useEffect, useState } from 'react';
import { z } from 'zod';

import type { OutlookMap } from '@/lib/planning/plan';

export const OUTLOOK_HORIZON = 7;

const OutlookResponse = z.object({
  data: z.object({
    status: z.enum(['available', 'candidate', 'stale', 'in_development', 'missing']),
    forecast: z.object({
      run: z.object({ origin: z.string() }),
      points: z.array(z.object({ horizon_day: z.number(), predicted_change: z.number() })),
    }),
  }),
  provenance: z.object({
    model_version: z.string(),
    dataset_version: z.string(),
    preprocessing_version: z.string(),
    data_cutoff: z.string(),
    artifact_status: z.string(),
  }),
  limitations: z.array(z.string()),
});

export type OutlookProvenance = z.infer<typeof OutlookResponse>['provenance'] & {
  readonly origin: string;
};

export type OutlookState =
  | { readonly status: 'loading'; readonly map: OutlookMap }
  | { readonly status: 'unavailable'; readonly map: OutlookMap }
  | {
      readonly status: 'ready';
      readonly map: OutlookMap;
      readonly isDemo: boolean;
      readonly provenance: OutlookProvenance;
      readonly limitations: readonly string[];
    };

const EMPTY: OutlookMap = new Map();

async function fetchOne(commodity: string, signal: AbortSignal) {
  const response = await fetch(`/bff/outlook/${commodity}?horizon=${String(OUTLOOK_HORIZON)}`, {
    signal,
    cache: 'no-store',
  });
  if (!response.ok) return null;
  const parsed = OutlookResponse.safeParse(await response.json());
  return parsed.success ? { commodity, body: parsed.data } : null;
}

export function useOutlook(): OutlookState {
  const [state, setState] = useState<OutlookState>({ status: 'loading', map: EMPTY });

  useEffect(() => {
    const controller = new AbortController();
    void Promise.all(
      modelCommodities().map((commodity) =>
        fetchOne(commodity, controller.signal).catch(() => null),
      ),
    ).then((results) => {
      if (controller.signal.aborted) return;
      const found = results.flatMap((result) => (result === null ? [] : [result]));
      const first = found[0];
      if (first === undefined) {
        setState({ status: 'unavailable', map: EMPTY });
        return;
      }
      const map = new Map(
        found.flatMap(({ commodity, body }) => {
          const point = body.data.forecast.points.find((p) => p.horizon_day === OUTLOOK_HORIZON);
          if (point === undefined || body.data.status === 'missing') return [];
          return [
            [commodity, { status: body.data.status, predictedChange: point.predicted_change }],
          ] as const;
        }),
      );
      setState({
        status: 'ready',
        map,
        isDemo: first.body.data.status === 'in_development',
        provenance: { ...first.body.provenance, origin: first.body.data.forecast.run.origin },
        limitations: first.body.limitations,
      });
    });
    return () => {
      controller.abort();
    };
  }, []);

  return state;
}
