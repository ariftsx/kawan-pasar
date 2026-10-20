// Field-level building blocks shared by every contract (docs 08 §2).
import { z } from 'zod';

/** Market date `YYYY-MM-DD` (WIB). */
export const MarketDate = z.iso.date();

/** ISO 8601 timestamp that must carry an explicit offset, e.g. `2026-10-14T12:00:00+07:00`. */
export const Timestamp = z.iso.datetime({ offset: true });

/** Whole rupiah, never negative. */
export const Rupiah = z.int().nonnegative();

/** Whole rupiah or `null` when a value is unknown. Missing values are never sent as 0. */
export const NullableRupiah = Rupiah.nullable();

/** Fractional change: `0.028` = 2.8 %. Must stay above −100 %. (zod 4 numbers are finite.) */
export const ChangeRatio = z.number().gt(-1);

export const ShareRatio = z.number().min(0).max(1);

/** Commodity / ingredient slug, e.g. `cabai-merah-keriting`. */
export const Slug = z
  .string()
  .max(64)
  .regex(/^[a-z0-9][a-z0-9-]*$/)
  .refine((value) => !value.includes('--') && !value.endsWith('-'), {
    message: 'Slug tidak boleh berisi "--" atau diakhiri "-".',
  });

const ULID = /^[0-9A-HJKMNP-TV-Z]{26}$/;

/** Crockford base32 ULID behind a short type prefix, e.g. `mnu_01JABCDEFGHJKMNPQRSTVWXYZ0`. */
export function prefixedId(prefix: string) {
  const head = `${prefix}_`;
  return z
    .string()
    .refine((value) => value.startsWith(head) && ULID.test(value.slice(head.length)), {
      message: `Harus berupa ${head}<ULID>.`,
    });
}

/** Semantic version `MAJOR.MINOR.PATCH`. */
export const SemVer = z.string().regex(/^\d+\.\d+\.\d+$/);

export const Sha256Hex = z.string().regex(/^[0-9a-f]{64}$/);
