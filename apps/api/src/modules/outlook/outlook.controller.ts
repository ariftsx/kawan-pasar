// Example chain for F0-X4: web BFF -> this route -> model-svc. The full Outlook feature (F4)
// adds the publishing gate, staleness, and storage; the response shape here already follows
// docs 08 §3 so the BFF and UI can build on it.
import {
  Forecast,
  HORIZON_DAYS,
  ModalityAvailability,
  OutlookStatus,
  Provenance,
  Slug,
} from '@kawan-pasar/contracts';
import { Controller, Get, Param, Query, Req } from '@nestjs/common';
import { z } from 'zod';

import { AppError } from '../../common/app-error.js';
import { resolveRequestId } from '../../common/request-id.js';
import { ModelClient } from '../../infra/model-client.js';

import type { FastifyRequest } from 'fastify';

const SCHEMA_VERSION = '1.0.0';

/** What model-svc returns for /internal/forecasts (services/model app/api/internal.py). */
const ModelForecast = z.object({
  data: Forecast,
  provenance: Provenance,
  availability: ModalityAvailability,
  limitations: z.array(z.string().min(1)),
  outlook_status: OutlookStatus,
});

const Horizon = z.coerce
  .number()
  .int()
  .refine((day) => (HORIZON_DAYS as readonly number[]).includes(day));

@Controller('v1/outlook')
export class OutlookController {
  constructor(private readonly model: ModelClient) {}

  @Get(':slug')
  async outlook(
    @Param('slug') slug: string,
    @Query('horizon') horizon: string | undefined,
    @Req() request: FastifyRequest,
  ) {
    if (!Slug.safeParse(slug).success) throw new AppError('NOT_FOUND', 'Komoditas tidak dikenal.');
    const horizonDay = horizon === undefined ? undefined : Horizon.safeParse(horizon);
    if (horizonDay?.success === false) {
      throw new AppError('INVALID_HORIZON', 'Horizon tidak didukung.');
    }
    const requestId = resolveRequestId(request.raw);
    const raw = await this.model.get(`/internal/forecasts/${slug}`, requestId);
    const parsed = ModelForecast.safeParse(raw);
    // A malformed model answer is the model's fault, never shown to the client as data.
    if (!parsed.success) {
      throw new AppError('MODEL_INCOMPATIBLE', 'Respons layanan perkiraan tidak sesuai kontrak.');
    }
    const { data, provenance, availability, limitations, outlook_status } = parsed.data;
    const points =
      horizonDay === undefined
        ? data.points
        : data.points.filter((point) => point.horizon_day === horizonDay.data);
    return {
      data: { status: outlook_status, forecast: { ...data, points } },
      meta: {
        request_id: requestId,
        schema_version: SCHEMA_VERSION,
        generated_at: new Date().toISOString(),
      },
      provenance,
      availability,
      limitations,
      error: null,
    };
  }
}
