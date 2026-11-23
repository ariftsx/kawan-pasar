import { z } from 'zod';
import { CommodityCodeSchema, IsoDateTime } from './common.js';

// Mode Analis (Fase 3A). Validated in the BFF and again in the API.

export const UserRoleSchema = z.enum(['user', 'analyst', 'admin']);
export type UserRole = z.infer<typeof UserRoleSchema>;

export const AnalystRequestInputSchema = z.strictObject({
  /** Why the downloads are needed (research, TPID, thesis...). */
  reason: z.string().trim().min(10).max(500),
  organization: z.string().trim().max(120).optional(),
});
export type AnalystRequestInput = z.infer<typeof AnalystRequestInputSchema>;

export const AnalystRequestStatusSchema = z.enum(['pending', 'approved', 'rejected']);

export const AnalystStatusResponseSchema = z.strictObject({
  role: UserRoleSchema,
  /** The latest request, if any. */
  request: z
    .strictObject({
      status: AnalystRequestStatusSchema,
      createdAt: IsoDateTime,
      /** Shown when rejected. */
      note: z.string().max(500).nullable(),
    })
    .nullable(),
  /** A new request may be sent now (verified e-mail, not analyst yet, none pending). */
  canRequest: z.boolean(),
});
export type AnalystStatusResponse = z.infer<typeof AnalystStatusResponseSchema>;

const IsoDay = z.iso.date();

/** CSV export filter: comma-separated catalog codes (default: all with data) and a date range. */
export const ExportQuerySchema = z
  .strictObject({
    commodities: z
      .string()
      .max(200)
      .transform((s) => s.split(',').filter((c) => c !== ''))
      .pipe(z.array(CommodityCodeSchema).min(1).max(10))
      .optional(),
    from: IsoDay.optional(),
    to: IsoDay.optional(),
  })
  .refine((q) => q.from === undefined || q.to === undefined || q.from <= q.to, {
    message: 'from_after_to',
    path: ['from'],
  });
export type ExportQuery = z.infer<typeof ExportQuerySchema>;

/** Excel/Sheets treat a leading = + - @ (or tab/CR) as a formula: neutralise it (OWASP CSV injection). */
export function csvCell(value: string | number | null): string {
  if (value === null) return '';
  const s = String(value);
  const safe = /^(\s*[=+\-@]|[\t\r])/.test(s) && !/^-?\d+(\.\d+)?$/.test(s) ? `'${s}` : s;
  return /[",\n\r]/.test(safe) ? `"${safe.replace(/"/g, '""')}"` : safe;
}
