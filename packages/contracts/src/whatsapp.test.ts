import { describe, expect, it } from 'vitest';
import {
  WhatsAppInboundSchema,
  WhatsAppResponseSchema,
  WhatsAppVerifyInputSchema,
  isStopMessage,
} from './whatsapp.js';

describe('WhatsApp contracts', () => {
  it('a code is six digits, spaces allowed', () => {
    expect(WhatsAppVerifyInputSchema.parse({ code: '123 456' })).toEqual({ code: '123456' });
    for (const code of ['12345', '1234567', 'abcdef', '12-3456']) {
      expect(WhatsAppVerifyInputSchema.safeParse({ code }).success, code).toBe(false);
    }
  });

  it('only "STOP" stops, in any case, with trailing punctuation', () => {
    for (const t of ['STOP', 'stop', ' Stop. ', 'STOP!']) expect(isStopMessage(t), t).toBe(true);
    for (const t of ['STOPP', 'tolong stop', 'BERHENTI', ''])
      expect(isStopMessage(t), t).toBe(false);
  });

  it('the status shows the number masked only', () => {
    expect(
      WhatsAppResponseSchema.safeParse({
        status: 'verified',
        phone: '+62 812 •••• 7890',
        canSendCode: false,
      }).success,
    ).toBe(true);
    expect(
      WhatsAppResponseSchema.safeParse({
        status: 'verified',
        phone: '+6281234567890',
        canSendCode: false,
      }).success,
    ).toBe(false);
    expect(WhatsAppInboundSchema.safeParse({ from: '0812', text: 'x'.repeat(1001) }).success).toBe(
      false,
    );
  });
});
