import type { z } from 'zod';

/** State returned by the account Server Actions to their forms (useActionState). */
export interface FormState {
  status: 'idle' | 'error' | 'done';
  /** Form-level message (error summary or confirmation). */
  message?: string;
  /** Field name → message. Never contains the submitted value. */
  fields?: Record<string, string>;
  /** Values safe to put back into the form (never passwords or tokens). */
  values?: { email?: string; phone?: string };
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
