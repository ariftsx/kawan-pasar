import { createHash, randomBytes } from 'node:crypto';
import { TokenSchema } from '@kawan-pasar/contracts';
import { and, eq, gt, isNull } from 'drizzle-orm';
import type { Clock } from '../../common/clock.js';
import type { Db } from '../../database/client.js';
import { authTokens } from '../../database/schema/index.js';
import { TOKEN_TTL_SECONDS } from './policy.js';

export type TokenPurpose = keyof typeof TOKEN_TTL_SECONDS;

const digest = (token: string): Buffer => createHash('sha256').update(token).digest();

/** Single-use e-mail tokens (verification, password reset). Only their SHA-256 is stored. */
export class AuthTokenService {
  constructor(
    private readonly db: Db,
    private readonly clock: Clock,
  ) {}

  /** A new token; any unused token of the same purpose for this user stops working. */
  async issue(userId: string, purpose: TokenPurpose): Promise<string> {
    const token = randomBytes(32).toString('base64url');
    const now = this.clock.now();
    await this.db.transaction(async (tx) => {
      await tx
        .delete(authTokens)
        .where(
          and(
            eq(authTokens.userId, userId),
            eq(authTokens.purpose, purpose),
            isNull(authTokens.usedAt),
          ),
        );
      await tx.insert(authTokens).values({
        userId,
        purpose,
        tokenHash: digest(token),
        expiresAt: new Date(now.getTime() + TOKEN_TTL_SECONDS[purpose] * 1000),
      });
    });
    return token;
  }

  /** The user of a usable token, without using it (to check a new password first). */
  async peek(token: string, purpose: TokenPurpose): Promise<string | null> {
    if (!TokenSchema.safeParse(token).success) return null;
    const rows = await this.db
      .select({ userId: authTokens.userId })
      .from(authTokens)
      .where(
        and(
          eq(authTokens.tokenHash, digest(token)),
          eq(authTokens.purpose, purpose),
          isNull(authTokens.usedAt),
          gt(authTokens.expiresAt, this.clock.now()),
        ),
      )
      .limit(1);
    return rows[0]?.userId ?? null;
  }

  /**
   * Marks the token used and returns its user, in one atomic statement: of concurrent uses only
   * one succeeds. Null when malformed, unknown, used, expired or meant for another purpose.
   */
  async consume(token: string, purpose: TokenPurpose): Promise<string | null> {
    if (!TokenSchema.safeParse(token).success) return null;
    const now = this.clock.now();
    const rows = await this.db
      .update(authTokens)
      .set({ usedAt: now })
      .where(
        and(
          eq(authTokens.tokenHash, digest(token)),
          eq(authTokens.purpose, purpose),
          isNull(authTokens.usedAt),
          gt(authTokens.expiresAt, now),
        ),
      )
      .returning({ userId: authTokens.userId });
    return rows[0]?.userId ?? null;
  }
}
