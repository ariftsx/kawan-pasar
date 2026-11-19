import { createCipheriv, createDecipheriv, createHmac, hkdfSync, randomBytes } from 'node:crypto';

/**
 * A number as stored: 12-byte GCM nonce, ciphertext with the 16-byte tag appended, and the id
 * of the key that sealed it (so a key rotation never makes numbers silently unreadable).
 */
export interface SealedPhone {
  nonce: Buffer;
  ciphertext: Buffer;
  keyId: number;
}

const TAG_BYTES = 16;

interface Key {
  id: number;
  enc: Buffer;
  mac: Buffer;
}

function deriveKey(secret: string): Key {
  if (secret.length < 32) throw new Error('PHONE_ENC_KEY must be at least 32 characters');
  const derive = (info: string, length: number): Buffer =>
    Buffer.from(hkdfSync('sha256', secret, 'kawan-pasar', info, length));
  // A public fingerprint of the key (15 bits, fits a smallint), never the key itself.
  const id = derive('phone-key-id-v1', 2).readUInt16BE(0) & 0x7fff;
  return { id, enc: derive('phone-enc-v1', 32), mac: derive('phone-mac-v1', 32) };
}

/**
 * Column-level encryption of the mobile number (Fase 2B; WhatsApp in 2C). Per key, HKDF derives
 * an AES-256-GCM key, an HMAC key for look-ups, and a key id. The user id is the additional
 * authenticated data, so a ciphertext copied to another row does not decrypt.
 *
 * Rotation: set the new secret as PHONE_ENC_KEY and the old one as PHONE_ENC_KEY_PREVIOUS.
 * Numbers sealed with the previous key still open (and are re-sealed when read); look-ups try
 * both keys.
 */
export class PhoneCipher {
  private readonly current: Key;
  private readonly previous: Key | null;

  constructor(secret: string, previousSecret?: string) {
    this.current = deriveKey(secret);
    this.previous =
      previousSecret === undefined || previousSecret === '' ? null : deriveKey(previousSecret);
    if (this.previous?.id === this.current.id) throw new Error('phone key ids collide');
  }

  get currentKeyId(): number {
    return this.current.id;
  }

  /** Ids of every key held: current first, then previous. */
  get keyIds(): number[] {
    return [this.current, this.previous].filter((k): k is Key => k !== null).map((k) => k.id);
  }

  isCurrent(keyId: number): boolean {
    return keyId === this.current.id;
  }

  encrypt(e164: string, userId: string): SealedPhone {
    const nonce = randomBytes(12);
    const c = createCipheriv('aes-256-gcm', this.current.enc, nonce);
    c.setAAD(Buffer.from(userId, 'utf8'));
    const body = Buffer.concat([c.update(e164, 'utf8'), c.final()]);
    return {
      nonce,
      ciphertext: Buffer.concat([body, c.getAuthTag()]),
      keyId: this.current.id,
    };
  }

  /** Throws when the key is unknown, or the ciphertext, its user or the key does not match. */
  decrypt(sealed: SealedPhone, userId: string): string {
    const key = [this.current, this.previous].find((k) => k?.id === sealed.keyId);
    if (key === undefined || key === null) throw new Error('unknown phone key');
    const { nonce, ciphertext } = sealed;
    const d = createDecipheriv('aes-256-gcm', key.enc, nonce);
    d.setAAD(Buffer.from(userId, 'utf8'));
    d.setAuthTag(ciphertext.subarray(ciphertext.length - TAG_BYTES));
    const body = ciphertext.subarray(0, ciphertext.length - TAG_BYTES);
    return Buffer.concat([d.update(body), d.final()]).toString('utf8');
  }

  /** Look-up hash under the current key (what new rows store). */
  lookupHash(e164: string): Buffer {
    return createHmac('sha256', this.current.mac).update(e164, 'utf8').digest();
  }

  /** Look-up hashes under every key held: current first, then previous. */
  lookupHashes(e164: string): Buffer[] {
    return [this.current, this.previous]
      .filter((k): k is Key => k !== null)
      .map((k) => createHmac('sha256', k.mac).update(e164, 'utf8').digest());
  }
}

/** The cipher configured by the environment (current key and, during a rotation, the previous). */
export const phoneCipherFromEnv = (env: {
  PHONE_ENC_KEY: string;
  PHONE_ENC_KEY_PREVIOUS?: string | undefined;
}): PhoneCipher => new PhoneCipher(env.PHONE_ENC_KEY, env.PHONE_ENC_KEY_PREVIOUS);
