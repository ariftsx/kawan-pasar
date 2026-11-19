import { createHmac } from 'node:crypto';
import { eq } from 'drizzle-orm';
import type { Db } from '../../database/client.js';
import type { PhoneCipher } from './phone-cipher.js';
import { authEvents, users } from '../../database/schema/index.js';

export interface UserRow {
  id: string;
  email: string;
  passwordHash: string;
  emailVerifiedAt: Date | null;
  createdAt: Date;
  /** Decrypted E.164 number, or null when none is stored (or it no longer decrypts). */
  phone: string | null;
}

export type AuthEventType = (typeof authEvents.$inferInsert)['type'];

const columns = {
  id: users.id,
  email: users.email,
  passwordHash: users.passwordHash,
  emailVerifiedAt: users.emailVerifiedAt,
  createdAt: users.createdAt,
  phoneNonce: users.phoneNonce,
  phoneCiphertext: users.phoneCiphertext,
};

type StoredRow = Omit<UserRow, 'phone'> & {
  phoneNonce: Buffer | null;
  phoneCiphertext: Buffer | null;
};

const UNIQUE_VIOLATION = '23505';

export class UsersRepository {
  constructor(
    private readonly db: Db,
    private readonly secret: string,
    private readonly phones: PhoneCipher,
  ) {}

  async findByEmail(email: string): Promise<UserRow | null> {
    // `email` is citext: the comparison ignores case.
    const rows = await this.db.select(columns).from(users).where(eq(users.email, email)).limit(1);
    return this.open(rows[0]);
  }

  async findById(id: string): Promise<UserRow | null> {
    const rows = await this.db.select(columns).from(users).where(eq(users.id, id)).limit(1);
    return this.open(rows[0]);
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

  /** Stores (or with null, removes) the user's mobile number. */
  async setPhone(id: string, phone: string | null): Promise<void> {
    const values =
      phone === null
        ? { phoneNonce: null, phoneCiphertext: null, phoneHmac: null }
        : this.seal(id, phone);
    await this.db.update(users).set(values).where(eq(users.id, id));
  }

  private seal(
    id: string,
    phone: string,
  ): { phoneNonce: Buffer; phoneCiphertext: Buffer; phoneHmac: Buffer } {
    const sealed = this.phones.encrypt(phone, id);
    return {
      phoneNonce: sealed.nonce,
      phoneCiphertext: sealed.ciphertext,
      phoneHmac: this.phones.lookupHash(phone),
    };
  }

  private open(row: StoredRow | undefined): UserRow | null {
    if (row === undefined) return null;
    const { phoneNonce, phoneCiphertext, ...rest } = row;
    let phone: string | null = null;
    if (phoneNonce !== null && phoneCiphertext !== null) {
      try {
        phone = this.phones.decrypt({ nonce: phoneNonce, ciphertext: phoneCiphertext }, row.id);
      } catch {
        phone = null; // wrong key or tampered row: treat as no number, never as an error page
      }
    }
    return { ...rest, phone };
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
