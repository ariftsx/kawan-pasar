// Error contract (docs 08 §8): stable codes mapped to one HTTP status each.
import { z } from 'zod';

export const ERROR_STATUS = {
  INVALID_REQUEST: 400,
  INVALID_HORIZON: 400,
  INVALID_DATE_RANGE: 400,
  UNAUTHENTICATED: 401,
  FORBIDDEN: 403,
  CSRF_INVALID: 403,
  NOT_FOUND: 404,
  ARTIFACT_NOT_FOUND: 404,
  MODEL_VERSION_NOT_FOUND: 404,
  VERSION_CONFLICT: 409,
  IDEMPOTENCY_CONFLICT: 409,
  PAYLOAD_TOO_LARGE: 413,
  SCHEMA_INVALID: 422,
  TEMPORAL_DATA_INVALID: 422,
  MODEL_INCOMPATIBLE: 422,
  RATE_LIMITED: 429,
  INTERNAL_ERROR: 500,
  MODEL_UNAVAILABLE: 503,
  FORECAST_UNAVAILABLE: 503,
  DEPENDENCY_UNAVAILABLE: 503,
} as const;

export type ErrorCode = keyof typeof ERROR_STATUS;

export const ErrorCode = z.enum(Object.keys(ERROR_STATUS) as [ErrorCode, ...ErrorCode[]]);

/** The body never carries a stack trace (docs 13 §A3). */
export const ApiError = z.strictObject({
  code: ErrorCode,
  message: z.string().min(1).max(500),
  request_id: z.string().min(1),
});

export type ApiError = z.infer<typeof ApiError>;
