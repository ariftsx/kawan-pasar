import { randomBytes } from 'node:crypto';
import { hash, verify } from '@node-rs/argon2';
import { ApiHttpError, rateLimited } from '../../common/api-errors.js';
import type { BreachedPasswords } from './breached-passwords.js';
import { HashGate, HashGateFull } from './hash-gate.js';

/** OWASP Password Storage Cheat Sheet: Argon2id, 19 MiB, 2 passes, 1 lane (the library default). */
const PARAMS = { memoryCost: 19_456, timeCost: 2, parallelism: 1 } as const;
const CURRENT = `$argon2id$v=19$m=${String(PARAMS.memoryCost)},t=${String(PARAMS.timeCost)},p=${String(PARAMS.parallelism)}$`;

export type PolicyProblem = 'too_short' | 'too_long' | 'breached' | 'same_as_email';

export interface VerifyResult {
  ok: boolean;
  /** The hash is valid but uses other parameters: store a fresh hash after sign-in. */
  needsRehash: boolean;
}

export class PasswordService {
  private dummy: Promise<string> | undefined;

  constructor(
    private readonly breached: BreachedPasswords,
    private readonly gate: HashGate = new HashGate({
      concurrency: 2,
      maxQueue: 16,
      maxWaitMs: 2_000,
    }),
  ) {}

  hash(password: string): Promise<string> {
    return this.gated(() => hash(password, PARAMS));
  }

  /** Every Argon2 call goes through the gate; at capacity the caller gets 429 (Retry-After 1). */
  private async gated<T>(job: () => Promise<T>): Promise<T> {
    try {
      return await this.gate.run(job);
    } catch (e) {
      if (e instanceof HashGateFull) throw rateLimited(1);
      throw e;
    }
  }

  async verify(stored: string, password: string): Promise<VerifyResult> {
    let ok: boolean;
    try {
      ok = await this.gated(() => verify(stored, password));
    } catch (e) {
      // At capacity: the 429 goes to the caller. Anything else is a malformed stored hash.
      if (e instanceof ApiHttpError) throw e;
      return { ok: false, needsRehash: false };
    }
    return { ok, needsRehash: ok && !stored.startsWith(CURRENT) };
  }

  /**
   * Same Argon2 work as a real check, against a hash nobody knows the password of: an unknown
   * e-mail address takes as long to refuse as a wrong password (no timing oracle).
   */
  async verifyDummy(password: string): Promise<VerifyResult> {
    this.dummy ??= this.hash(randomBytes(32).toString('base64url'));
    await this.verify(await this.dummy, password);
    return { ok: false, needsRehash: false };
  }

  /** Why a new password is refused, or null. Length is counted in Unicode code points. */
  policyProblem(password: string, email: string): PolicyProblem | null {
    const length = Array.from(password).length;
    if (length < 12) return 'too_short';
    if (length > 128) return 'too_long';
    if (password.trim().toLowerCase() === email.trim().toLowerCase()) return 'same_as_email';
    if (this.breached.has(password)) return 'breached';
    return null;
  }
}
