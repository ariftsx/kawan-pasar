import { createCipheriv, createDecipheriv, createHmac, hkdfSync, randomBytes } from 'node:crypto';

/** A number as stored: 12-byte GCM nonce, and ciphertext with the 16-byte tag appended. */
export interface SealedPhone {
  nonce: Buffer;
  ciphertext: Buffer;
}

const TAG_BYTES = 16;

/**
 * Column-level encryption of the optional mobile number (Fase 2B; same scheme as the WhatsApp
 * channel in 2C). Two keys are derived from `PHONE_ENC_KEY` with HKDF: one for AES-256-GCM, one
 * for an HMAC used to look a number up without decrypting. The user id is the additional
 * authenticated data, so a ciphertext copied to another row does not decrypt.
 */
export class PhoneCipher {
  private readonly encKey: Buffer;
  private readonly macKey: Buffer;

  constructor(secret: string) {
    if (secret.length < 32) throw new Error('PHONE_ENC_KEY must be at least 32 characters');
    const derive = (info: string): Buffer =>
      Buffer.from(hkdfSync('sha256', secret, 'kawan-pasar', info, 32));
    this.encKey = derive('phone-enc-v1');
    this.macKey = derive('phone-mac-v1');
  }

  encrypt(e164: string, userId: string): SealedPhone {
    const nonce = randomBytes(12);
    const c = createCipheriv('aes-256-gcm', this.encKey, nonce);
    c.setAAD(Buffer.from(userId, 'utf8'));
    const body = Buffer.concat([c.update(e164, 'utf8'), c.final()]);
    return { nonce, ciphertext: Buffer.concat([body, c.getAuthTag()]) };
  }

  /** Throws when the ciphertext, its user or the key does not match. */
  decrypt(sealed: SealedPhone, userId: string): string {
    const { nonce, ciphertext } = sealed;
    const d = createDecipheriv('aes-256-gcm', this.encKey, nonce);
    d.setAAD(Buffer.from(userId, 'utf8'));
    d.setAuthTag(ciphertext.subarray(ciphertext.length - TAG_BYTES));
    const body = ciphertext.subarray(0, ciphertext.length - TAG_BYTES);
    return Buffer.concat([d.update(body), d.final()]).toString('utf8');
  }

  lookupHash(e164: string): Buffer {
    return createHmac('sha256', this.macKey).update(e164, 'utf8').digest();
  }
}
