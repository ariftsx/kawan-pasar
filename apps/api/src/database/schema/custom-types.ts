import { customType } from 'drizzle-orm/pg-core';

/** Case-insensitive text (PostgreSQL `citext` extension): e-mail addresses. */
export const citext = customType<{ data: string }>({
  dataType: () => 'citext',
});

/** Raw bytes (`bytea`): hashes of tokens and IP addresses. */
export const bytea = customType<{ data: Buffer; driverData: Buffer }>({
  dataType: () => 'bytea',
});
