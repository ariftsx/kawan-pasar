/** DI token for the cache-side Valkey client. Kept apart from the module to avoid import cycles. */
export const VALKEY_CACHE = Symbol('VALKEY_CACHE');
