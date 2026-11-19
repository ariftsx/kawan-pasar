import { z } from 'zod';
import { MaskedPhoneSchema } from './auth.js';

// WhatsApp channel (Fase 2C, local mock adapter). Validated in the BFF and again in the API.

export const WhatsAppStatusSchema = z.enum(['none', 'pending', 'verified', 'stopped']);
export type WhatsAppStatus = z.infer<typeof WhatsAppStatusSchema>;

export const WhatsAppResponseSchema = z.strictObject({
  /** none = never connected (or the number changed); pending = code sent, not yet confirmed. */
  status: WhatsAppStatusSchema,
  /** The account's number, masked; null when the account has none (set it in /akun first). */
  phone: MaskedPhoneSchema.nullable(),
  /** A code may be requested now (account verified, number present, under the send limits). */
  canSendCode: z.boolean(),
});
export type WhatsAppResponse = z.infer<typeof WhatsAppResponseSchema>;

/** Six digits, as typed (spaces allowed between groups, e.g. "123 456"). */
export const WhatsAppCodeSchema = z
  .string()
  .trim()
  .max(16)
  .transform((s) => s.replace(/\s/g, ''))
  .pipe(z.string().regex(/^\d{6}$/));

export const WhatsAppVerifyInputSchema = z.strictObject({ code: WhatsAppCodeSchema });
export type WhatsAppVerifyInput = z.infer<typeof WhatsAppVerifyInputSchema>;

/** A message from a phone to the service (mock of the provider's webhook). */
export const WhatsAppInboundSchema = z.strictObject({
  from: z.string().max(32),
  text: z.string().max(1000),
});
export type WhatsAppInbound = z.infer<typeof WhatsAppInboundSchema>;

/** "STOP", "stop", " Stop. " → true. Only this word stops the channel. */
export const isStopMessage = (text: string): boolean =>
  text
    .trim()
    .replace(/[.!]+$/, '')
    .toUpperCase() === 'STOP';
