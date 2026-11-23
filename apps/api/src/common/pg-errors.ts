/** SQLSTATE of a pg error, also when Drizzle wraps it (DrizzleQueryError.cause). */
export function pgCode(e: unknown): string | undefined {
  if (typeof e !== 'object' || e === null) return undefined;
  const own: unknown = Reflect.get(e, 'code');
  if (typeof own === 'string') return own;
  const cause: unknown = Reflect.get(e, 'cause');
  return cause === undefined ? undefined : pgCode(cause);
}

export const UNIQUE_VIOLATION = '23505';
