import { createHmac } from 'node:crypto';
import { eq } from 'drizzle-orm';
import type { Db } from '../../database/client.js';
import { authEvents, users } from '../../database/schema/index.js';

export interface UserRow {
  id: string;
  email: string;
  passwordHash: string;
  emailVerifiedAt: Date | null;
  createdAt: Date;
}

export type AuthEventType = (typeof authEvents.$inferInsert)['type'];

const columns = {
  id: users.id,
  email: users.email,
  passwordHash: users.passwordHash,
  emailVerifiedAt: users.emailVerifiedAt,
  createdAt: users.createdAt,
};

const UNIQUE_VIOLATION = '23505';

export class UsersRepository {
  constructor(
    private readonly db: Db,
    private readonly secret: string,
  ) {}

  async findByEmail(email: string): Promise<UserRow | null> {
    // `email` is citext: the comparison ignores case.
    const rows = await this.db.select(columns).from(users).where(eq(users.email, email)).limit(1);
    return rows[0] ?? null;
  }

  async findById(id: string): Promise<UserRow | null> {
    const rows = await this.db.select(columns).from(users).where(eq(users.id, id)).limit(1);
    return rows[0] ?? null;
  }

  /** The new user's id, or null when the address is already registered (also under a race). */
  async create(email: string, passwordHash: string): Promise<string | null> {
    try {
      const rows = await this.db
        .insert(users)
        .values({ email, passwordHash })
        .returning({ id: users.id });
      return rows[0]?.id ?? null;
    } catch (e) {
      if (pgCode(e) === UNIQUE_VIOLATION) return null;
      throw e;
    }
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
