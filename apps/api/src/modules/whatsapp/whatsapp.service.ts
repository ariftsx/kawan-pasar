import { createHmac, randomInt, timingSafeEqual } from 'node:crypto';
import type { WhatsAppResponse } from '@kawan-pasar/contracts';
import { PhoneSchema, isStopMessage, maskPhone } from '@kawan-pasar/contracts';
import { ApiHttpError, conflict, rateLimited } from '../../common/api-errors.js';
import type { Clock } from '../../common/clock.js';
import type { PhoneCipher } from '../auth/phone-cipher.js';
import type { UsersRepository } from '../auth/users.repository.js';
import type { WhatsAppRepository } from './whatsapp.repository.js';
import type { WhatsAppOutbox } from './whatsapp.queue.js';
import { HttpStatus } from '@nestjs/common';

/** Plan Fase 2C § 4: 10 minutes, 5 attempts, 3 codes an hour per account, 5 a day per number. */
export const CODE_TTL_MS = 10 * 60 * 1000;
export const CODE_ATTEMPTS = 5;
export const CODES_PER_HOUR_PER_USER = 3;
export const CODES_PER_DAY_PER_NUMBER = 5;
const HOUR = 3600 * 1000;

/** Wrong code (field "code") or no usable code any more (field "expired"). */
const badCode = (field: 'code' | 'expired'): ApiHttpError =>
  new ApiHttpError(HttpStatus.BAD_REQUEST, 'invalid_token', 'invalid code', { fields: [field] });

export class WhatsAppService {
  constructor(
    private readonly repo: WhatsAppRepository,
    private readonly users: UsersRepository,
    private readonly phones: PhoneCipher,
    private readonly outbox: WhatsAppOutbox,
    private readonly secret: string,
    private readonly clock: Clock,
  ) {}

  private codeHash(userId: string, code: string): Buffer {
    return createHmac('sha256', this.secret).update(`wa-code:${userId}:${code}`).digest();
  }

  async status(userId: string): Promise<WhatsAppResponse> {
    const user = await this.users.findById(userId);
    const phone = user?.phone ?? null;
    const channel = await this.repo.channel(userId);
    // A channel verified for another number (changed since) counts as not connected.
    const sameNumber =
      channel !== null &&
      phone !== null &&
      this.phones.lookupHashes(phone).some((h) => h.equals(channel.phoneHmac));
    const status = channel === null || !sameNumber ? 'none' : channel.status;
    const canSendCode =
      (user?.emailVerifiedAt ?? null) !== null &&
      phone !== null &&
      status !== 'verified' &&
      (await this.underCodeLimits(userId, this.phones.lookupHashes(phone))) === null;
    return { status, phone: phone === null ? null : maskPhone(phone), canSendCode };
  }

  /** Seconds to wait when a limit is reached, else null. */
  /** For the status only (the button); sending re-checks inside a locked transaction. */
  private async underCodeLimits(
    userId: string,
    phoneHashes: readonly Buffer[],
  ): Promise<number | null> {
    const now = this.clock.now().getTime();
    const hour = await this.repo.countByUser(userId, ['code'], new Date(now - HOUR));
    if (hour >= CODES_PER_HOUR_PER_USER) return 3600;
    const day = await this.repo.countByPhone(phoneHashes, 'code', new Date(now - 24 * HOUR));
    return day >= CODES_PER_DAY_PER_NUMBER ? 24 * 3600 : null;
  }

  async sendCode(userId: string): Promise<void> {
    const user = await this.users.findById(userId);
    if (!user?.emailVerifiedAt) throw conflict('email');
    if (user.phone === null) throw conflict('phone');
    const phoneHmac = this.phones.lookupHash(user.phone);
    const channel = await this.repo.channel(userId);
    if (channel?.status === 'verified' && channel.phoneHmac.equals(phoneHmac)) {
      throw conflict('verified');
    }
    const code = String(randomInt(0, 1_000_000)).padStart(6, '0');
    const now = this.clock.now();
    const wait = await this.repo.startVerificationWithinLimits({
      userId,
      phoneHmac,
      phoneHashes: this.phones.lookupHashes(user.phone),
      codeHash: this.codeHash(userId, code),
      expiresAt: new Date(now.getTime() + CODE_TTL_MS),
      now,
      perUserHour: CODES_PER_HOUR_PER_USER,
      perNumberDay: CODES_PER_DAY_PER_NUMBER,
    });
    if (wait !== null) throw rateLimited(wait);
    await this.outbox.send({ kind: 'code', userId, code });
  }

  async verify(userId: string, code: string, ip: string): Promise<void> {
    const reserved = await this.repo.reserveAttempt(userId, this.clock.now());
    if (reserved === null) throw badCode('expired');
    if (!timingSafeEqual(this.codeHash(userId, code), reserved.codeHash)) {
      throw badCode(reserved.attempts >= CODE_ATTEMPTS ? 'expired' : 'code');
    }
    if (!(await this.repo.markVerified(userId, reserved.codeHash))) throw badCode('expired');
    await this.users.recordEvent(userId, 'wa_verify', ip, this.clock.now());
  }

  async disconnect(userId: string): Promise<void> {
    await this.repo.remove(userId);
  }

  /**
   * A message from a phone (mock of the provider webhook). "STOP" stops every channel of that
   * number; anything else from a known number gets a short help reply; unknown numbers get
   * nothing. The caller always gets the same answer.
   */
  async inbound(from: string, text: string): Promise<void> {
    const phone = PhoneSchema.safeParse(from);
    if (!phone.success) return;
    const channels = await this.repo.channelsByPhone(this.phones.lookupHashes(phone.data));
    if (channels.length === 0) return;
    const now = this.clock.now();
    if (isStopMessage(text)) {
      const active = channels.filter((c) => c.status !== 'stopped');
      await this.repo.stop(active.map((c) => c.userId));
      for (const c of active) {
        await this.users.recordEvent(c.userId, 'wa_stop', 'whatsapp', now);
        await this.outbox.send({ kind: 'reply', userId: c.userId, reply: 'stopped' });
      }
      return;
    }
    for (const c of channels.filter((x) => x.status === 'verified')) {
      await this.outbox.send({ kind: 'reply', userId: c.userId, reply: 'help' });
    }
  }
}
