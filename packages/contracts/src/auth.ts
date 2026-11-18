import { z } from 'zod';
import { IsoDateTime } from './common.js';

// Account contracts (Fase 2A): validated in the Next.js Server Actions and again in the API.

/** RFC 5321 limit. Kept as typed (case preserved for display); compared case-insensitively. */
export const EmailSchema = z.string().trim().max(254).pipe(z.email());

// Code points (not UTF-16 units, not graphemes), as OWASP counts password length.
const codePoints = (s: string): number => Array.from(s).length;

/**
 * New passwords (NIST SP 800-63B, OWASP ASVS 2.1): length only, no composition rules, never
 * trimmed. Counted in Unicode code points. The breached-list and same-as-e-mail checks run in
 * the API, which holds the list.
 */
export const PasswordSchema = z
  .string()
  .refine((s) => codePoints(s) >= 12, { message: 'too_short' })
  .refine((s) => codePoints(s) <= 128, { message: 'too_long' });

/** A password being checked (sign-in, confirmation): only bounded, the policy applies on set. */
const PresentedPassword = z.string().min(1).max(512);

/** 32 random bytes, base64url without padding. */
export const TokenSchema = z.string().regex(/^[A-Za-z0-9_-]{43}$/);

export const RegisterInputSchema = z.strictObject({
  email: EmailSchema,
  password: PasswordSchema,
  acceptPrivacy: z.literal(true),
});
export type RegisterInput = z.infer<typeof RegisterInputSchema>;

export const LoginInputSchema = z.strictObject({ email: EmailSchema, password: PresentedPassword });
export type LoginInput = z.infer<typeof LoginInputSchema>;

export const ForgotInputSchema = z.strictObject({ email: EmailSchema });
export type ForgotInput = z.infer<typeof ForgotInputSchema>;

export const ResetInputSchema = z.strictObject({ token: TokenSchema, password: PasswordSchema });
export type ResetInput = z.infer<typeof ResetInputSchema>;

export const VerifyInputSchema = z.strictObject({ token: TokenSchema });
export type VerifyInput = z.infer<typeof VerifyInputSchema>;

export const ChangePasswordInputSchema = z.strictObject({
  current: PresentedPassword,
  next: PasswordSchema,
});
export type ChangePasswordInput = z.infer<typeof ChangePasswordInputSchema>;

export const DeleteAccountInputSchema = z.strictObject({ password: PresentedPassword });
export type DeleteAccountInput = z.infer<typeof DeleteAccountInputSchema>;

/** Session id shown to the user: first 16 bytes of the session hash, hex. */
export const SessionIdSchema = z.string().regex(/^[0-9a-f]{32}$/);

export const LoginResponseSchema = z.strictObject({
  token: TokenSchema,
  csrf: TokenSchema,
  expiresAt: IsoDateTime,
});
export type LoginResponse = z.infer<typeof LoginResponseSchema>;

export const MeResponseSchema = z.strictObject({
  id: z.uuid(),
  email: z.string().max(254),
  emailVerified: z.boolean(),
  createdAt: IsoDateTime,
  /**
   * The session's CSRF secret. Only the BFF sees it (server side) and renders it into the
   * account forms; a cross-site page cannot read it (synchronizer token pattern).
   */
  csrf: TokenSchema,
});
export type MeResponse = z.infer<typeof MeResponseSchema>;

export const SessionsResponseSchema = z.strictObject({
  items: z.array(
    z.strictObject({
      id: SessionIdSchema,
      current: z.boolean(),
      createdAt: IsoDateTime,
      lastSeenAt: IsoDateTime,
      /** Coarse description from the User-Agent ("Chrome · Windows"), never the full string. */
      device: z.string().max(80),
    }),
  ),
});
export type SessionsResponse = z.infer<typeof SessionsResponseSchema>;

export const AuthErrorCodeSchema = z.enum([
  'invalid_credentials',
  'locked',
  'rate_limited',
  'weak_password',
  'invalid_token',
  'csrf',
  'unauthenticated',
]);
export type AuthErrorCode = z.infer<typeof AuthErrorCodeSchema>;
