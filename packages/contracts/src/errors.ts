import { z } from 'zod';

export const ApiErrorCodeSchema = z.enum([
  'bad_request',
  'unauthorized',
  'not_found',
  'rate_limited',
  'internal',
  // Accounts (Fase 2A)
  'unauthenticated',
  'invalid_credentials',
  'locked',
  'weak_password',
  'invalid_token',
  'csrf',
  // Alerts (Fase 2B): already watched, or the watch limit is reached.
  'conflict',
  // Fase 3: signed in, but the role does not allow it.
  'forbidden',
]);
export type ApiErrorCode = z.infer<typeof ApiErrorCodeSchema>;

/** Error body. Never echoes raw input; `fields` holds field names only. */
export const ApiErrorSchema = z.strictObject({
  error: z.strictObject({
    code: ApiErrorCodeSchema,
    message: z.string(),
    fields: z.array(z.string()).optional(),
  }),
});
export type ApiError = z.infer<typeof ApiErrorSchema>;
