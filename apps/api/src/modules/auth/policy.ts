// Every number of the account security policy (design Fase 2 §3), in one place.

export const SESSION = {
  /** A session not used for this long ends. */
  idleSeconds: 7 * 24 * 3600,
  /** A session ends after this long, used or not. */
  absoluteSeconds: 30 * 24 * 3600,
  /** "Last seen" is written at most this often (fewer Valkey writes per request). */
  touchEverySeconds: 5 * 60,
} as const;

/** Failed sign-ins per account → lock duration (seconds). Counted over a sliding hour. */
export const LOCKOUT_STEPS: readonly (readonly [failures: number, seconds: number])[] = [
  [20, 3600],
  [10, 900],
  [5, 60],
];
export const LOCKOUT_WINDOW_SECONDS = 3600;

export const TOKEN_TTL_SECONDS = {
  verify_email: 24 * 3600,
  reset_password: 30 * 60,
} as const;
