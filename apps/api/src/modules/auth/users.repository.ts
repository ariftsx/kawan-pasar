import { Logger } from '@nestjs/common';
import { createHmac } from 'node:crypto';
import { and, eq } from 'drizzle-orm';
import type { Db } from '../../database/client.js';
import type { PhoneCipher } from './phone-cipher.js';
import { authEvents, users, whatsappChannels } from '../../database/schema/index.js';

export interface UserRow {
  id: string;
  email: string;
  passwordHash: string;
  emailVerifiedAt: Date | null;
  createdAt: Date;
  /** Fase 3: user, analyst or admin. Read from the database on every role check. */
  role: UserRole;
  /** Decrypted E.164 number, or null when none is stored (or it no longer decrypts). */
  phone: string | null;
}

export type AuthEventType = (typeof authEvents.$inferInsert)['type'];
export type UserRole = (typeof users.$inferSelect)['role'];

const columns = {
  id: users.id,
  email: users.email,
  passwordHash: users.passwordHash,
  emailVerifiedAt: users.emailVerifiedAt,
  createdAt: users.createdAt,
  role: users.role,
  phoneNonce: users.phoneNonce,
  phoneCiphertext: users.phoneCiphertext,
  phoneKeyId: users.phoneKeyId,
  phoneHmac: users.phoneHmac,
};

type StoredRow = Omit<UserRow, 'phone'> & {
  phoneNonce: Buffer | null;
  phoneCiphertext: Buffer | null;
  phoneKeyId: number | null;
  phoneHmac: Buffer | null;
};

const UNIQUE_VIOLATION = '23505';

export class UsersRepository {
  constructor(
    private readonly db: Db,
    private readonly secret: string,
    private readonly phones: PhoneCipher,
    /** Told (count only, never the number) when a stored number cannot be opened. */
    private readonly onUndecryptable: () => void = () => undefined,
  ) {}

  async findByEmail(email: string): Promise<UserRow | null> {
    // `email` is citext: the comparison ignores case.
    const rows = await this.db.select(columns).from(users).where(eq(users.email, email)).limit(1);
    return await this.open(rows[0]);
  }

  async findById(id: string): Promise<UserRow | null> {
    const rows = await this.db.select(columns).from(users).where(eq(users.id, id)).limit(1);
    return await this.open(rows[0]);
  }

  /** The new user's id, or null when the address is already registered (also under a race). */
  async create(email: string, passwordHash: string, phone?: string): Promise<string | null> {
    try {
      return await this.db.transaction(async (tx) => {
        const rows = await tx
          .insert(users)
          .values({ email, passwordHash })
          .returning({ id: users.id });
        const id = rows[0]?.id ?? null;
        // The ciphertext is bound to the user id (AAD), so it is written once the id exists.
        if (id !== null && phone !== undefined) {
          await tx.update(users).set(this.seal(id, phone)).where(eq(users.id, id));
        }
        return id;
      });
    } catch (e) {
      if (pgCode(e) === UNIQUE_VIOLATION) return null;
      throw e;
    }
  }

  /**
   * Stores (or with null, removes) the user's mobile number. The WhatsApp channel goes with the
   * old number in the same transaction: a new number must be verified again (Fase 2C).
   */
  async setPhone(id: string, phone: string | null): Promise<void> {
    const values =
      phone === null
        ? { phoneNonce: null, phoneCiphertext: null, phoneHmac: null, phoneKeyId: null }
        : this.seal(id, phone);
    await this.db.transaction(async (tx) => {
      await tx.update(users).set(values).where(eq(users.id, id));
      await tx.delete(whatsappChannels).where(eq(whatsappChannels.userId, id));
    });
  }

  private seal(
    id: string,
    phone: string,
  ): { phoneNonce: Buffer; phoneCiphertext: Buffer; phoneHmac: Buffer; phoneKeyId: number } {
    const sealed = this.phones.encrypt(phone, id);
    return {
      phoneNonce: sealed.nonce,
      phoneCiphertext: sealed.ciphertext,
      phoneHmac: this.phones.lookupHash(phone),
      phoneKeyId: sealed.keyId,
    };
  }

  private async open(row: StoredRow | undefined): Promise<UserRow | null> {
    if (row === undefined) return null;
    const { phoneNonce, phoneCiphertext, phoneKeyId, phoneHmac: _hmac, ...rest } = row;
    let phone: string | null = null;
    if (phoneNonce !== null && phoneCiphertext !== null) {
      // Rows of Fase 2B carry no key id: try every key held (current first).
      const candidates = phoneKeyId === null ? this.phones.keyIds : [phoneKeyId];
      let openedWith: number | null = null;
      for (const keyId of candidates) {
        try {
          phone = this.phones.decrypt(
            { nonce: phoneNonce, ciphertext: phoneCiphertext, keyId },
            row.id,
          );
          openedWith = keyId;
          break;
        } catch {
          phone = null;
        }
      }
      // Unknown key or tampered row: no number on screen (never an error page), but reported.
      if (phone === null) this.onUndecryptable();
      // Opened with the previous key (or a legacy row): re-seal with the current one.
      if (
        phone !== null &&
        openedWith !== null &&
        (phoneKeyId === null || !this.phones.isCurrent(openedWith))
      ) {
        await this.reseal(row.id, phone, phoneNonce, row.phoneHmac);
      }
    }
    return { ...rest, phone };
  }

  /**
   * Re-seals a number with the current key, only if the row still holds what was read (its
   * nonce): a number changed meanwhile is never overwritten. The WhatsApp channel's HMAC moves to
   * the current key in the same transaction, so it survives dropping the previous key.
   * True when re-sealed.
   */
  async reseal(
    id: string,
    phone: string,
    readNonce: Buffer,
    readHmac: Buffer | null,
  ): Promise<boolean> {
    const fresh = this.seal(id, phone);
    return this.db.transaction(async (tx) => {
      const done = await tx
        .update(users)
        .set(fresh)
        .where(and(eq(users.id, id), eq(users.phoneNonce, readNonce)))
        .returning({ id: users.id });
      if (done.length === 0) return false;
      if (readHmac !== null) {
        await tx
          .update(whatsappChannels)
          .set({ phoneHmac: fresh.phoneHmac })
          .where(and(eq(whatsappChannels.userId, id), eq(whatsappChannels.phoneHmac, readHmac)));
      }
      return true;
    });
  }

  /** Sets the role (Fase 3). Callers check who may do this; the CLI never grants admin here. */
  async setRole(id: string, role: UserRole): Promise<void> {
    await this.db.update(users).set({ role }).where(eq(users.id, id));
  }

  async markVerified(id: string, at: Date): Promise<void> {
    await this.db.update(users).set({ emailVerifiedAt: at }).where(eq(users.id, id));
  }

  async setPassword(id: string, passwordHash: string, at: Date): Promise<void> {
    await this.db
      .update(users)
      .set({ passwordHash, passwordChangedAt: at })
      .where(eq(users.id, id));
  }

  /** Permanent: tokens go with the user (cascade), audit events keep no user (set null). */
  async delete(id: string): Promise<void> {
    await this.db.delete(users).where(eq(users.id, id));
  }

  /** Audit trail. The client IP only as an HMAC salted per day; no address, password or token. */
  async recordEvent(
    userId: string | null,
    type: AuthEventType,
    ip: string,
    at: Date,
  ): Promise<void> {
    const day = at.toISOString().slice(0, 10);
    const ipHash = createHmac('sha256', `${this.secret}:${day}`).update(ip).digest();
    await this.db.insert(authEvents).values({ userId, type, ipHash });
  }
}

/** SQLSTATE of a pg error, also when Drizzle wraps it (DrizzleQueryError.cause). */
function pgCode(e: unknown): string | undefined {
  if (typeof e !== 'object' || e === null) return undefined;
  const own: unknown = Reflect.get(e, 'code');
  if (typeof own === 'string') return own;
  const cause: unknown = Reflect.get(e, 'cause');
  return cause === undefined ? undefined : pgCode(cause);
}

const undecryptableLog = new Logger('UsersRepository');
/** Logged (no number, no user id) when a stored phone number cannot be opened. */
export const undecryptablePhone = (): void => {
  undecryptableLog.error('stored phone number could not be decrypted (PHONE_ENC_KEY rotated?)');
};
