// Response envelope shared by every `/v1` endpoint (docs 08 §3).
import { z } from 'zod';

import { ArtifactStatus, Availability } from './enums.js';
import { ApiError } from './errors.js';
import { SemVer, Timestamp } from './primitives.js';

export const ResponseMeta = z.strictObject({
  request_id: z.string().min(1),
  schema_version: SemVer,
  generated_at: Timestamp,
});

/** Required on every response that carries a forecast or context. */
export const Provenance = z.strictObject({
  model_version: z.string().min(1),
  dataset_version: z.string().min(1),
  preprocessing_version: z.string().min(1),
  data_cutoff: Timestamp,
  artifact_status: ArtifactStatus,
});

export const ModalityAvailability = z.strictObject({
  price: Availability,
  climate: Availability,
  news: Availability,
  macro_logistics: Availability,
  calendar: Availability,
});

/** Builds the success envelope around `data`. */
export function successEnvelope<T extends z.ZodType>(data: T) {
  return z.strictObject({
    data,
    meta: ResponseMeta,
    provenance: Provenance.optional(),
    availability: ModalityAvailability.optional(),
    limitations: z.array(z.string().min(1)).default([]),
    error: z.null(),
  });
}

export const ErrorEnvelope = z.strictObject({
  data: z.null(),
  error: ApiError,
});
