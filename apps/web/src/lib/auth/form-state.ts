import type { z } from 'zod';

/** State returned by the account Server Actions to their forms (useActionState). */
export interface FormState {
  status: 'idle' | 'error' | 'done';
  /** Form-level message (error summary or confirmation). */
  message?: string;
  /** Field name → message. Never contains the submitted value. */
  fields?: Record<string, string>;
  /** Values safe to put back into the form (never passwords or tokens). */
  values?: {
    email?: string;
    phone?: string;
    reason?: string;
    organization?: string;
    // Fase 3B admin forms (article editor, decisions).
    slug?: string;
    category?: string;
    title?: string;
    summary?: string;
    bodyMd?: string;
    note?: string;
  };
  /** Fase 3B: the admin must (re)enter the password; the form shows the field. */
  needsConfirm?: boolean;
  /** Fase 3B: the password was just confirmed (the form stops asking for it). */
  confirmedNow?: boolean;
  /** Fase 3B: a found account (admin user search), shown under the form. */
  found?: {
    id: string;
    email: string;
    role: string;
    emailVerified: boolean;
    createdAt: string;
  } | null;
}

export const IDLE: FormState = { status: 'idle' };

/** First message per field from a failed contract check, in the user's language. */
export function fieldErrors(
  error: z.ZodError,
  messages: Record<string, string>,
): Record<string, string> {
  const out: Record<string, string> = {};
  for (const issue of error.issues) {
    const field = String(issue.path[0] ?? '_');
    out[field] ??= messages[field] ?? 'Periksa isian ini.';
  }
  return out;
}
